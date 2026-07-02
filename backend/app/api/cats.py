from __future__ import annotations

from typing import Any

import asyncpg  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException

from app.core.error_handlers import error_response
from app.db.pool import get_db
from app.services.map_service import get_cat_profile, list_cats

VALID_COAT_COLORS = {
    "black", "white", "orange", "gray", "brown",
    "cream", "mixed_black_white", "mixed_orange_white", "other",
}
VALID_PATTERN_TYPES = {
    "tabby", "calico", "tuxedo", "solid", "bicolor",
    "tortoiseshell", "pointed", "other",
}
VALID_TNR_STATUSES = {
    "unassessed", "needs_tnr", "scheduled", "in_progress", "completed", "ear_tipped",
}

router = APIRouter(prefix="/api/v1/cats", tags=["cats"])


@router.get("")
async def cats_list_endpoint(
    page: int = 1,
    per_page: int = 20,
    coat_color: str | None = None,
    pattern_type: str | None = None,
    tnr_status: str | None = None,
    db: asyncpg.Pool = Depends(get_db),
) -> dict[str, Any]:
    """Paginated cat list with optional filters."""
    errors = []
    if page < 1:
        errors.append({"field": "page", "message": "Must be >= 1"})
    if per_page < 1 or per_page > 100:
        errors.append({"field": "per_page", "message": "Must be between 1 and 100"})
    if coat_color is not None and coat_color not in VALID_COAT_COLORS:
        valid = ", ".join(sorted(VALID_COAT_COLORS))
        errors.append({"field": "coat_color", "message": f"Must be one of: {valid}"})
    if pattern_type is not None and pattern_type not in VALID_PATTERN_TYPES:
        valid = ", ".join(sorted(VALID_PATTERN_TYPES))
        errors.append({"field": "pattern_type", "message": f"Must be one of: {valid}"})
    if tnr_status is not None and tnr_status not in VALID_TNR_STATUSES:
        valid = ", ".join(sorted(VALID_TNR_STATUSES))
        errors.append({"field": "tnr_status", "message": f"Must be one of: {valid}"})

    if errors:
        raise HTTPException(
            status_code=422,
            detail=error_response(422, "Invalid parameters", details=errors),
        )

    return await list_cats(db, page, per_page, coat_color, pattern_type, tnr_status)


@router.get("/{cat_id}")
async def cat_detail_endpoint(
    cat_id: str,
    db: asyncpg.Pool = Depends(get_db),
) -> dict[str, Any]:
    """Full cat profile with status_tags, sighting history, and TNR records."""
    profile = await get_cat_profile(db, cat_id)
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail=error_response(404, "Cat not found"),
        )
    return profile
