# backend/app/api/map.py

from __future__ import annotations

import asyncpg  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException

from app.core.error_handlers import error_response
from app.db.pool import get_db
from app.services.map_service import get_map_markers

router = APIRouter(prefix="/api/v1/map", tags=["map"])


@router.get("")
async def map_endpoint(
    min_lat: float,
    min_lng: float,
    max_lat: float,
    max_lng: float,
    db: asyncpg.Pool = Depends(get_db),
) -> dict[str, list]:
    """Get map markers (sightings + feeding spots) within a bounding box."""
    errors = []
    if not (-90 <= min_lat <= 90):
        errors.append({"field": "min_lat", "message": "Must be between -90 and 90"})
    if not (-90 <= max_lat <= 90):
        errors.append({"field": "max_lat", "message": "Must be between -90 and 90"})
    if not (-180 <= min_lng <= 180):
        errors.append({"field": "min_lng", "message": "Must be between -180 and 180"})
    if not (-180 <= max_lng <= 180):
        errors.append({"field": "max_lng", "message": "Must be between -180 and 180"})
    if min_lat >= max_lat:
        errors.append({"field": "min_lat", "message": "Must be less than max_lat"})
    if min_lng >= max_lng:
        errors.append({"field": "min_lng", "message": "Must be less than max_lng"})

    if errors:
        raise HTTPException(
            status_code=422,
            detail=error_response(422, "Invalid bounding box", details=errors),
        )

    return await get_map_markers(db, min_lat, min_lng, max_lat, max_lng)
