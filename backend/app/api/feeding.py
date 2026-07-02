from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.error_handlers import error_response
from app.core.rbac import require_role
from app.db.pool import get_db
from app.models.user import User, UserRole
from app.services.feeding_service import (
    create_feeding_spot,
    create_report,
    create_tnr_record,
)

VALID_TNR_STATUSES = {
    "unassessed", "needs_tnr", "scheduled", "in_progress", "completed", "ear_tipped",
}

router = APIRouter(prefix="/api/v1", tags=["feeding", "tnr", "reports"])


class FeedingSpotRequest(BaseModel):
    latitude: float
    longitude: float
    details: dict[str, Any]


@router.post("/feeding-spots", status_code=201)
async def feeding_spot_endpoint(
    body: FeedingSpotRequest,
    user: User = Depends(require_role(UserRole.SIGNED_IN)),
    db: asyncpg.Pool = Depends(get_db),
) -> dict[str, Any]:
    """Create a feeding spot."""
    errors = []
    if not (-90 <= body.latitude <= 90):
        errors.append({"field": "latitude", "message": "Must be between -90 and 90"})
    if not (-180 <= body.longitude <= 180):
        errors.append({"field": "longitude", "message": "Must be between -180 and 180"})
    if errors:
        raise HTTPException(
            status_code=422,
            detail=error_response(422, "Invalid parameters", details=errors),
        )

    return await create_feeding_spot(db, user.id, body.latitude, body.longitude, body.details)


class TnrRecordRequest(BaseModel):
    cat_id: UUID
    content: str
    status_change: str | None = None


@router.post("/tnr-records", status_code=201)
async def tnr_record_endpoint(
    body: TnrRecordRequest,
    user: User = Depends(require_role(UserRole.SIGNED_IN)),
    db: asyncpg.Pool = Depends(get_db),
) -> dict[str, Any]:
    """Create a TNR record. Status change requires verified role."""
    if body.status_change is not None and body.status_change not in VALID_TNR_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=error_response(
                422,
                "Invalid parameters",
                details=[{
                    "field": "status_change",
                    "message": f"Must be one of: {', '.join(sorted(VALID_TNR_STATUSES))}",
                }],
            ),
        )

    return await create_tnr_record(
        db=db,
        user_id=user.id,
        cat_id=str(body.cat_id),
        content=body.content,
        status_change=body.status_change,
        is_verified=user.role == UserRole.VERIFIED,
    )


class ReportRequest(BaseModel):
    content_type: str
    content_id: UUID
    reason: str
    details: str | None = None


@router.post("/reports", status_code=201)
async def report_endpoint(
    body: ReportRequest,
    user: User = Depends(require_role(UserRole.SIGNED_IN)),
    db: asyncpg.Pool = Depends(get_db),
) -> dict[str, str]:
    """Report content for moderation."""
    return await create_report(
        db=db,
        reporter_id=user.id,
        content_type=body.content_type,
        content_id=str(body.content_id),
        reason=body.reason,
        details=body.details,
    )
