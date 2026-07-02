from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import asyncpg
from fastapi import HTTPException, UploadFile

from app.core.error_handlers import error_response
from app.services.coordinate_service import blur_coordinate
from app.services.embedding_service import embedding_service
from app.services.image_service import upload_image


async def initiate_sighting(
    db: asyncpg.Pool,
    user_id: str,
    image: UploadFile,
    latitude: float,
    longitude: float,
    observed_at: str,
    condition_tags: list[str],
    coat_color: str,
    pattern_type: str,
    notable_markings: str | None,
    ear_tip_status: bool | None,
    body_size: str | None,
    notes: str | None,
) -> dict[str, Any]:
    """Create a sighting draft and find cat matches.

    Returns dict with draft_id, photo_url, blurred_location, candidates.
    """
    contents = await image.read()
    header = contents[:12]

    from app.services.image_service import validate_image

    errors = validate_image(image.content_type, len(contents), header)
    if errors:
        raise HTTPException(
            status_code=422,
            detail=error_response(
                422,
                "Image validation failed",
                details=[{"field": "image", "message": e} for e in errors],
            ),
        )

    await image.seek(0)
    photo_url = await upload_image(image)
    blurred_lat, blurred_lng = blur_coordinate(latitude, longitude)
    embedding = await embedding_service.extract_embedding(contents)

    candidates = await embedding_service.find_matches(
        db, embedding, coat_color=coat_color, pattern_type=pattern_type
    )

    draft_id = str(uuid4())
    await db.execute(
        """
        INSERT INTO sighting_drafts (
            id, user_id, photo_url,
            location, blurred_location,
            observed_at, condition_tags,
            coat_color, pattern_type, notable_markings,
            ear_tip_status, body_size, notes,
            embedding, match_candidates
        ) VALUES (
            $1, $2, $3,
            ST_SetSRID(ST_MakePoint($4, $5), 4326),
            ST_SetSRID(ST_MakePoint($6, $7), 4326),
            $8, $9::jsonb,
            $10, $11, $12,
            $13, $14, $15,
            $16::vector, $17::jsonb
        )
        """,
        draft_id,
        user_id,
        photo_url,
        longitude,
        latitude,
        blurred_lng,
        blurred_lat,
        datetime.fromisoformat(observed_at),
        condition_tags,
        coat_color,
        pattern_type,
        notable_markings,
        ear_tip_status,
        body_size,
        notes,
        f"[{','.join(str(x) for x in embedding)}]",
        candidates,
    )

    return {
        "draft_id": draft_id,
        "photo_url": photo_url,
        "blurred_location": {"latitude": blurred_lat, "longitude": blurred_lng},
        "candidates": candidates,
    }


async def confirm_sighting(
    db: asyncpg.Pool,
    user_id: str,
    draft_id: str,
    cat_id: str | None,
) -> dict[str, str]:
    """Confirm a sighting draft into a permanent sighting.

    If cat_id is None, creates a new cat profile ("none of these").
    Returns dict with sighting_id and cat_profile_id.
    """
    draft = await db.fetchrow(
        "SELECT * FROM sighting_drafts WHERE id = $1",
        draft_id,
    )
    if draft is None:
        raise HTTPException(
            status_code=404,
            detail=error_response(404, "Draft not found"),
        )

    if draft["user_id"] != user_id:
        raise HTTPException(
            status_code=403,
            detail=error_response(403, "Not your draft"),
        )

    if draft["draft_expires_at"] < datetime.now(UTC):
        raise HTTPException(
            status_code=410,
            detail=error_response(410, "Draft expired"),
        )

    async with db.acquire() as conn, conn.transaction():
        if cat_id is not None:
            cat = await conn.fetchrow(
                "SELECT id FROM cat_profiles WHERE id = $1",
                cat_id,
            )
            if cat is None:
                raise HTTPException(
                    status_code=404,
                    detail=error_response(404, "Cat profile not found"),
                )
        else:
            cat_id = await _create_cat_from_draft(conn, draft, user_id)

        sighting_id = str(uuid4())
        await conn.execute(
            """
            INSERT INTO sightings (
                id, cat_profile_id, user_id, photo_url,
                location, blurred_location,
                observed_at, condition_tags,
                coat_color, pattern_type, notable_markings,
                ear_tip_status, body_size, notes
            ) VALUES (
                $1, $2, $3, $4,
                $5, $6,
                $7, $8::jsonb,
                $9, $10, $11,
                $12, $13, $14
            )
            """,
            sighting_id,
            cat_id,
            user_id,
            draft["photo_url"],
            draft["location"],
            draft["blurred_location"],
            draft["observed_at"],
            draft["condition_tags"],
            draft["coat_color"],
            draft["pattern_type"],
            draft["notable_markings"],
            draft["ear_tip_status"],
            draft["body_size"],
            draft["notes"],
        )

        await conn.execute("DELETE FROM sighting_drafts WHERE id = $1", draft_id)

    return {"sighting_id": sighting_id, "cat_profile_id": cat_id}


async def _create_cat_from_draft(
    conn: asyncpg.Connection,
    draft: asyncpg.Record,
    user_id: str,
) -> str:
    """Create a new cat profile from sighting draft metadata + embedding.

    Per decisions doc #11: copies coat_color, pattern_type, notable_markings,
    ear_tip_status, body_size, embedding. Name is NULL (decisions doc #12).
    """
    cat_id = str(uuid4())
    embedding = draft["embedding"]
    embedding_str = f"[{','.join(str(x) for x in embedding)}]" if embedding else None
    ear_tip_status = draft["ear_tip_status"] if draft["ear_tip_status"] is not None else False

    await conn.execute(
        """
        INSERT INTO cat_profiles (
            id, name, coat_color, pattern_type, notable_markings,
            ear_tip_status, body_size, embedding, created_by
        ) VALUES (
            $1, NULL, $2, $3, $4,
            $5, $6, $7::vector, $8
        )
        """,
        cat_id,
        draft["coat_color"],
        draft["pattern_type"],
        draft["notable_markings"],
        ear_tip_status,
        draft["body_size"],
        embedding_str,
        user_id,
    )

    return cat_id
