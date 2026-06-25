import asyncpg
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.db.pool import get_db
from app.models.user import User, UserRole
from app.core.rbac import require_role
from app.services.auth_service import (
    list_verification_requests,
    review_verification_request,
)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


class ReviewRequest(BaseModel):
    status: str


@router.get("/verification-requests")
async def list_verification_requests_endpoint(
    status: str | None = None,
    user: User = Depends(require_role(UserRole.VERIFIED)),
    db: asyncpg.Pool = Depends(get_db),
) -> dict:
    requests = await list_verification_requests(db, status)
    return {"requests": requests}


@router.patch("/verification-requests/{request_id}")
async def review_verification_request_endpoint(
    request_id: str,
    body: ReviewRequest,
    user: User = Depends(require_role(UserRole.VERIFIED)),
    db: asyncpg.Pool = Depends(get_db),
) -> dict:
    result = await review_verification_request(db, request_id, user.id, body.status)
    return result
