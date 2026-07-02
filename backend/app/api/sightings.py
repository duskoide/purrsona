from __future__ import annotations

import json
from typing import Any

import asyncpg  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.error_handlers import error_response
from app.core.rbac import require_role
from app.db.pool import get_db
from app.models.user import User, UserRole
from app.services.sighting_service import confirm_sighting, initiate_sighting

VALID_COAT_COLORS = {
    "black", "white", "orange", "gray", "brown",
    "cream", "mixed_black_white", "mixed_orange_white", "other",
}
VALID_PATTERN_TYPES = {
    "tabby", "calico", "tuxedo", "solid", "bicolor",
    "tortoiseshell", "pointed", "other",
}
VALID_BODY_SIZES = {"small", "medium", "large"}

router = APIRouter(prefix="/api/v1/sightings", tags=["sightings"])


@router.post("/initiate", status_code=201)
async def initiate_endpoint(
    image: UploadFile,
    latitude: float,
    longitude: float,
    observed_at: str,
    condition_tags: str,
    coat_color: str,
    pattern_type: str,
    notable_markings: str | None = None,
    ear_tip_status: bool | None = None,
    body_size: str | None = None,
    notes: str | None = None,
    user: User = Depends(require_role(UserRole.SIGNED_IN)),
    db: asyncpg.Pool = Depends(get_db),
) -> dict[str, Any]:
    """Create a sighting draft and find cat matches."""
    param_errors = []
    if coat_color not in VALID_COAT_COLORS:
        valid = ", ".join(sorted(VALID_COAT_COLORS))
        param_errors.append(
            {"field": "coat_color", "message": f"Invalid value. Must be one of: {valid}"}
        )
    if pattern_type not in VALID_PATTERN_TYPES:
        valid = ", ".join(sorted(VALID_PATTERN_TYPES))
        param_errors.append(
            {"field": "pattern_type", "message": f"Invalid value. Must be one of: {valid}"}
        )
    if body_size is not None and body_size not in VALID_BODY_SIZES:
        valid = ", ".join(sorted(VALID_BODY_SIZES))
        param_errors.append(
            {"field": "body_size", "message": f"Invalid value. Must be one of: {valid}"}
        )
    if param_errors:
        raise HTTPException(
            status_code=422,
            detail=error_response(422, "Invalid parameters", details=param_errors),
        )

    try:
        tags = json.loads(condition_tags)
        if not isinstance(tags, list) or not all(isinstance(t, str) for t in tags):
            raise ValueError
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(
            status_code=422,
            detail=error_response(
                422,
                "Invalid parameters",
                details=[{"field": "condition_tags", "message": "Must be a JSON array of strings"}],
            ),
        )

    if not tags:
        raise HTTPException(
            status_code=422,
            detail=error_response(
                422,
                "Invalid parameters",
                details=[{"field": "condition_tags", "message": "At least one condition tag is required"}],
            ),
        )

    return await initiate_sighting(
        db=db,
        user_id=user.id,
        image=image,
        latitude=latitude,
        longitude=longitude,
        observed_at=observed_at,
        condition_tags=tags,
        coat_color=coat_color,
        pattern_type=pattern_type,
        notable_markings=notable_markings,
        ear_tip_status=ear_tip_status,
        body_size=body_size,
        notes=notes,
    )


class ConfirmRequest(BaseModel):
    draft_id: str
    cat_id: str | None = None


@router.post("/confirm", status_code=201)
async def confirm_endpoint(
    body: ConfirmRequest,
    user: User = Depends(require_role(UserRole.SIGNED_IN)),
    db: asyncpg.Pool = Depends(get_db),
) -> dict[str, str]:
    """Confirm a sighting draft. cat_id=None means 'none of these'."""
    return await confirm_sighting(
        db=db,
        user_id=user.id,
        draft_id=body.draft_id,
        cat_id=body.cat_id,
    )
