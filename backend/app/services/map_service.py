# backend/app/services/map_service.py

from __future__ import annotations

import asyncio
import json
from typing import Any

import asyncpg


async def get_map_markers(
    db: asyncpg.Pool,
    min_lat: float,
    min_lng: float,
    max_lat: float,
    max_lng: float,
) -> dict[str, list]:
    """Get sightings and feeding spots within a bounding box."""
    sighting_rows = await db.fetch(
        """
        SELECT
            s.id,
            ST_Y(s.blurred_location::geometry) AS lat,
            ST_X(s.blurred_location::geometry) AS lng,
            s.observed_at,
            s.condition_tags,
            c.id AS cat_id,
            c.name AS cat_name,
            c.tnr_status,
            c.coat_color,
            c.pattern_type
        FROM sightings s
        JOIN cat_profiles c ON s.cat_profile_id = c.id
        WHERE s.blurred_location && ST_MakeEnvelope($1, $2, $3, $4, 4326)
        ORDER BY s.observed_at DESC
        LIMIT 500
        """,
        min_lng, min_lat, max_lng, max_lat,
    )

    sightings = []
    for row in sighting_rows:
        sightings.append(
            {
                "id": str(row["id"]),
                "blurred_location": {
                    "latitude": float(row["lat"]),
                    "longitude": float(row["lng"]),
                },
                "observed_at": row["observed_at"].isoformat(),
                "condition_tags": json.loads(row["condition_tags"]),
                "cat": {
                    "id": str(row["cat_id"]),
                    "name": row["cat_name"] or "Unknown",
                    "tnr_status": row["tnr_status"],
                    "coat_color": row["coat_color"],
                    "pattern_type": row["pattern_type"],
                },
            }
        )

    spot_rows = await db.fetch(
        """
        SELECT
            id,
            ST_Y(blurred_location::geometry) AS lat,
            ST_X(blurred_location::geometry) AS lng,
            details
        FROM feeding_spots
        WHERE blurred_location && ST_MakeEnvelope($1, $2, $3, $4, 4326)
        LIMIT 500
        """,
        min_lng, min_lat, max_lng, max_lat,
    )

    feeding_spots = []
    for row in spot_rows:
        feeding_spots.append(
            {
                "id": str(row["id"]),
                "blurred_location": {
                    "latitude": float(row["lat"]),
                    "longitude": float(row["lng"]),
                },
                "details": json.loads(row["details"]),
            }
        )

    return {"sightings": sightings, "feeding_spots": feeding_spots}


async def list_cats(
    db: asyncpg.Pool,
    page: int = 1,
    per_page: int = 20,
    coat_color: str | None = None,
    pattern_type: str | None = None,
    tnr_status: str | None = None,
) -> dict[str, Any]:
    """Paginated cat list with optional filters."""
    conditions = []
    params: list[Any] = []
    idx = 1

    if coat_color is not None:
        conditions.append(f"coat_color::text = ${idx}")
        params.append(coat_color)
        idx += 1
    if pattern_type is not None:
        conditions.append(f"pattern_type::text = ${idx}")
        params.append(pattern_type)
        idx += 1
    if tnr_status is not None:
        conditions.append(f"tnr_status::text = ${idx}")
        params.append(tnr_status)
        idx += 1

    where = ""
    if conditions:
        where = "WHERE " + " AND ".join(conditions)

    count_row = await db.fetchrow(f"SELECT COUNT(*) AS total FROM cat_profiles {where}", *params)
    total = count_row["total"]

    offset = (page - 1) * per_page
    params.extend([per_page, offset])

    rows = await db.fetch(
        f"""
        SELECT
            cp.id,
            cp.name,
            cp.tnr_status,
            cp.coat_color,
            cp.pattern_type,
            cp.ear_tip_status,
            cp.photos,
            (
                SELECT s.photo_url
                FROM sightings s
                WHERE s.cat_profile_id = cp.id
                ORDER BY s.observed_at DESC
                LIMIT 1
            ) AS latest_sighting_photo
        FROM cat_profiles cp
        {where}
        ORDER BY cp.created_at DESC
        LIMIT ${idx} OFFSET ${idx + 1}
        """,
        *params,
    )

    cats = []
    for row in rows:
        photos = json.loads(row["photos"])
        latest_photo = row["latest_sighting_photo"] or (photos[0] if photos else None)
        cats.append(
            {
                "id": str(row["id"]),
                "name": row["name"] or "Unknown",
                "tnr_status": row["tnr_status"],
                "coat_color": row["coat_color"],
                "pattern_type": row["pattern_type"],
                "ear_tip_status": row["ear_tip_status"],
                "latest_photo": latest_photo,
            }
        )

    return {"cats": cats, "total": total, "page": page, "per_page": per_page}


async def get_cat_profile(
    db: asyncpg.Pool,
    cat_id: str,
) -> dict[str, Any] | None:
    """Full cat profile with computed status_tags, sighting history, and TNR records."""
    cat, tag_rows, sighting_rows, tnr_rows = await asyncio.gather(
        db.fetchrow(
            "SELECT * FROM cat_profiles WHERE id = $1",
            cat_id,
        ),
        db.fetch(
            "SELECT DISTINCT jsonb_array_elements_text(condition_tags) AS tag "
            "FROM sightings WHERE cat_profile_id = $1",
            cat_id,
        ),
        db.fetch(
            """
            SELECT
                id,
                ST_Y(blurred_location::geometry) AS lat,
                ST_X(blurred_location::geometry) AS lng,
                observed_at,
                condition_tags,
                photo_url,
                notes
            FROM sightings
            WHERE cat_profile_id = $1
            ORDER BY observed_at DESC
            """,
            cat_id,
        ),
        db.fetch(
            """
        SELECT id, status_change, content, created_at
        FROM tnr_records
        WHERE cat_profile_id = $1
        ORDER BY created_at DESC
            """,
            cat_id,
        ),
    )

    if cat is None:
        return None

    status_tags = sorted(row["tag"] for row in tag_rows)

    sighting_history = []
    for row in sighting_rows:
        sighting_history.append(
            {
                "id": str(row["id"]),
                "blurred_location": {
                    "latitude": float(row["lat"]),
                    "longitude": float(row["lng"]),
                },
                "observed_at": row["observed_at"].isoformat(),
                "condition_tags": json.loads(row["condition_tags"]),
                "photo_url": row["photo_url"],
                "notes": row["notes"],
            }
        )

    tnr_records = []
    for row in tnr_rows:
        tnr_records.append(
            {
                "id": str(row["id"]),
                "status_change": row["status_change"],
                "notes": row["content"],
                "created_at": row["created_at"].isoformat(),
            }
        )

    return {
        "id": str(cat["id"]),
        "name": cat["name"],
        "photos": json.loads(cat["photos"]),
        "tnr_status": cat["tnr_status"],
        "coat_color": cat["coat_color"],
        "pattern_type": cat["pattern_type"],
        "notable_markings": cat["notable_markings"],
        "ear_tip_status": cat["ear_tip_status"],
        "body_size": cat["body_size"],
        "status_tags": status_tags,
        "sighting_history": sighting_history,
        "tnr_records": tnr_records,
    }
