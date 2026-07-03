from __future__ import annotations

from typing import Any

import asyncpg
from fastapi import HTTPException

from app.core.error_handlers import error_response

VALID_COAT_COLORS = {
    "black", "white", "orange", "gray", "brown",
    "cream", "mixed_black_white", "mixed_orange_white", "other",
}
VALID_PATTERN_TYPES = {
    "tabby", "calico", "tuxedo", "solid", "bicolor",
    "tortoiseshell", "pointed", "other",
}
VALID_BODY_SIZES = {"small", "medium", "large"}

ALLOWED_FIELDS = {"name", "coat_color", "pattern_type", "body_size", "ear_tip_status", "notable_markings"}


async def update_cat_profile(
    db: asyncpg.Pool,
    cat_id: str,
    updates: dict[str, Any],
) -> dict[str, Any] | None:
    """Update cat profile metadata. Returns updated profile or None if not found."""
    if not updates:
        raise HTTPException(
            status_code=422,
            detail=error_response(422, "No fields to update"),
        )

    errors = []
    if "coat_color" in updates and updates["coat_color"] not in VALID_COAT_COLORS:
        errors.append({"field": "coat_color", "message": f"Must be one of: {', '.join(sorted(VALID_COAT_COLORS))}"})
    if "pattern_type" in updates and updates["pattern_type"] not in VALID_PATTERN_TYPES:
        errors.append({"field": "pattern_type", "message": f"Must be one of: {', '.join(sorted(VALID_PATTERN_TYPES))}"})
    if "body_size" in updates and updates["body_size"] not in VALID_BODY_SIZES:
        errors.append({"field": "body_size", "message": f"Must be one of: {', '.join(sorted(VALID_BODY_SIZES))}"})
    if errors:
        raise HTTPException(
            status_code=422,
            detail=error_response(422, "Invalid parameters", details=errors),
        )

    filtered = {k: v for k, v in updates.items() if k in ALLOWED_FIELDS}
    if not filtered:
        raise HTTPException(
            status_code=422,
            detail=error_response(422, "No valid fields to update"),
        )

    set_clauses = []
    params: list[Any] = []
    for i, (field, value) in enumerate(filtered.items(), 1):
        set_clauses.append(f"{field} = ${i}")
        params.append(value)

    params.append(cat_id)
    query = f"""
        UPDATE cat_profiles
        SET {', '.join(set_clauses)}
        WHERE id = ${len(params)}
        RETURNING id, name, coat_color, pattern_type, body_size, ear_tip_status, notable_markings, tnr_status
    """

    row = await db.fetchrow(query, *params)
    if row is None:
        return None

    return {
        "id": str(row["id"]),
        "name": row["name"],
        "coat_color": row["coat_color"],
        "pattern_type": row["pattern_type"],
        "body_size": row["body_size"],
        "ear_tip_status": row["ear_tip_status"],
        "notable_markings": row["notable_markings"],
        "tnr_status": row["tnr_status"],
    }
