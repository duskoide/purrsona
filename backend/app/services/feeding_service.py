from __future__ import annotations

from typing import Any
from uuid import uuid4

import asyncpg
from fastapi import HTTPException

from app.core.error_handlers import error_response
from app.services.coordinate_service import blur_coordinate


async def create_feeding_spot(
    db: asyncpg.Pool,
    user_id: str,
    latitude: float,
    longitude: float,
    details: dict,
) -> dict[str, Any]:
    """Create a feeding spot with blurred coordinates."""
    blurred_lat, blurred_lng = blur_coordinate(latitude, longitude)
    spot_id = str(uuid4())

    await db.execute(
        """
        INSERT INTO feeding_spots (id, user_id, location, blurred_location, details)
        VALUES (
            $1, $2,
            ST_SetSRID(ST_MakePoint($3, $4), 4326),
            ST_SetSRID(ST_MakePoint($5, $6), 4326),
            $7::jsonb
        )
        """,
        spot_id,
        user_id,
        longitude,
        latitude,
        blurred_lng,
        blurred_lat,
        details,
    )

    return {
        "id": spot_id,
        "blurred_location": {"latitude": blurred_lat, "longitude": blurred_lng},
        "details": details,
    }


async def create_tnr_record(
    db: asyncpg.Pool,
    user_id: str,
    cat_id: str,
    content: str,
    status_change: str | None,
    is_verified: bool,
) -> dict[str, Any]:
    """Create a TNR record.

    If status_change provided and user is verified, also update cat TNR status.
    """
    cat = await db.fetchrow(
        "SELECT id FROM cat_profiles WHERE id = $1",
        cat_id,
    )
    if cat is None:
        raise HTTPException(
            status_code=404,
            detail=error_response(404, "Cat not found"),
        )

    if status_change is not None and not is_verified:
        raise HTTPException(
            status_code=403,
            detail=error_response(403, "TNR status changes require verified role"),
        )

    record_id = str(uuid4())

    async with db.acquire() as conn, conn.transaction():
            await conn.execute(
                """
                INSERT INTO tnr_records (id, cat_profile_id, user_id, content, status_change)
                VALUES ($1, $2, $3, $4, $5)
                """,
                record_id,
                cat_id,
                user_id,
                content,
                status_change,
            )

            if status_change is not None:
                await conn.execute(
                    "UPDATE cat_profiles SET tnr_status = $1 WHERE id = $2",
                    status_change,
                    cat_id,
                )

    return {
        "id": record_id,
        "cat_id": cat_id,
        "status_change": status_change,
    }


VALID_REASONS = {"inaccurate", "abusive", "unsafe", "other"}


async def create_report(
    db: asyncpg.Pool,
    reporter_id: str,
    content_type: str,
    content_id: str,
    reason: str,
    details: str | None,
) -> dict[str, str]:
    """Create a content report. Raises 404 if content not found."""
    if content_type == "sighting":
        exists = await db.fetchrow("SELECT id FROM sightings WHERE id = $1", content_id)
    elif content_type == "feeding_spot":
        exists = await db.fetchrow("SELECT id FROM feeding_spots WHERE id = $1", content_id)
    elif content_type == "tnr_record":
        exists = await db.fetchrow("SELECT id FROM tnr_records WHERE id = $1", content_id)
    else:
        raise HTTPException(
            status_code=422,
            detail=error_response(
                422,
                "Invalid content_type",
                details=[{
                    "field": "content_type",
                    "message": "Must be one of: sighting, feeding_spot, tnr_record",
                }],
            ),
        )

    if reason not in VALID_REASONS:
        raise HTTPException(
            status_code=422,
            detail=error_response(
                422,
                "Invalid reason",
                details=[{
                    "field": "reason",
                    "message": f"Must be one of: {', '.join(sorted(VALID_REASONS))}",
                }],
            ),
        )

    if exists is None:
        raise HTTPException(
            status_code=404,
            detail=error_response(404, "Content not found"),
        )

    report_id = str(uuid4())
    await db.execute(
        """
        INSERT INTO content_reports (id, reporter_id, content_type, content_id, reason, details)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        report_id,
        reporter_id,
        content_type,
        content_id,
        reason,
        details,
    )

    return {"id": report_id}
