# Map & Cat Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build public API endpoints for map markers, cat list, and cat profile detail.

**Architecture:** Service layer handles PostGIS spatial queries and profile assembly. Two API routers (map, cats) expose public endpoints. Map uses bounding box queries on blurred_location. Cat profile computes status_tags at read time from sighting condition_tags.

**Tech Stack:** Python 3.11, FastAPI, asyncpg, PostGIS

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `backend/app/services/map_service.py` | Create | Map markers, cat list, cat profile assembly |
| `backend/app/api/map.py` | Create | GET /api/v1/map endpoint |
| `backend/app/api/cats.py` | Create | GET /api/v1/cats and GET /api/v1/cats/{cat_id} |
| `backend/app/main.py` | Modify | Register map and cats routers |

---

### Task 1: Map & Cat Service

**Files:**
- Create: `backend/app/services/map_service.py`

- [ ] **Step 1: Create map service with all three functions**

```python
# backend/app/services/map_service.py

from __future__ import annotations

from typing import Any

import asyncpg


async def get_map_markers(
    db: asyncpg.Pool,
    min_lat: float,
    min_lng: float,
    max_lat: float,
    max_lng: float,
) -> dict[str, list]:
    """Get sightings and feeding spots within a bounding box.

    Uses PostGIS ST_MakeEnvelope on blurred_location.
    Returns {"sightings": [...], "feeding_spots": [...]}.
    """
    bbox = f"ST_MakeEnvelope({min_lng}, {min_lat}, {max_lng}, {max_lat}, 4326)"

    sighting_rows = await db.fetch(
        f"""
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
        WHERE s.blurred_location && {bbox}
        ORDER BY s.observed_at DESC
        """
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
                "condition_tags": row["condition_tags"],
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
        f"""
        SELECT
            id,
            ST_Y(blurred_location::geometry) AS lat,
            ST_X(blurred_location::geometry) AS lng,
            details
        FROM feeding_spots
        WHERE blurred_location && {bbox}
        """
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
                "details": row["details"],
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
    """Paginated cat list with optional filters.

    Returns {"cats": [...], "total": int, "page": int, "per_page": int}.
    """
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
        photos = row["photos"]
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
    """Full cat profile with computed status_tags, sighting history, and TNR records.

    Returns None if cat not found.
    """
    cat = await db.fetchrow(
        "SELECT * FROM cat_profiles WHERE id = $1",
        cat_id,
    )
    if cat is None:
        return None

    # Compute status_tags: deduplicated union of condition_tags across all sightings
    tag_rows = await db.fetch(
        "SELECT DISTINCT jsonb_array_elements_text(condition_tags) AS tag FROM sightings WHERE cat_profile_id = $1",
        cat_id,
    )
    status_tags = sorted(row["tag"] for row in tag_rows)

    # Sighting history
    sighting_rows = await db.fetch(
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
    )

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
                "condition_tags": row["condition_tags"],
                "photo_url": row["photo_url"],
                "notes": row["notes"],
            }
        )

    # TNR records
    tnr_rows = await db.fetch(
        """
        SELECT id, status_change, notes, created_at
        FROM tnr_records
        WHERE cat_profile_id = $1
        ORDER BY created_at DESC
        """,
        cat_id,
    )

    tnr_records = []
    for row in tnr_rows:
        tnr_records.append(
            {
                "id": str(row["id"]),
                "status_change": row["status_change"],
                "notes": row["notes"],
                "created_at": row["created_at"].isoformat(),
            }
        )

    return {
        "id": str(cat["id"]),
        "name": cat["name"],
        "photos": cat["photos"],
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
```

- [ ] **Step 2: Verify the module imports cleanly**

Run: `cd backend && python -c "from app.services.map_service import get_map_markers, list_cats, get_cat_profile; print('ok')"`
Expected: prints "ok"

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/map_service.py
git commit -m "feat: add map service with spatial queries and cat profile assembly"
```

---

### Task 2: Map API Router

**Files:**
- Create: `backend/app/api/map.py`

- [ ] **Step 1: Create map router with GET /map endpoint**

```python
# backend/app/api/map.py

from __future__ import annotations

from typing import Any

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
```

- [ ] **Step 2: Verify the module imports cleanly**

Run: `cd backend && python -c "from app.api.map import router; print('ok')"`
Expected: prints "ok"

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/map.py
git commit -m "feat: add map API endpoint with bounding box validation"
```

---

### Task 3: Cats API Router

**Files:**
- Create: `backend/app/api/cats.py`

- [ ] **Step 1: Create cats router with list and detail endpoints**

```python
# backend/app/api/cats.py

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
        errors.append({"field": "coat_color", "message": f"Must be one of: {', '.join(sorted(VALID_COAT_COLORS))}"})
    if pattern_type is not None and pattern_type not in VALID_PATTERN_TYPES:
        errors.append({"field": "pattern_type", "message": f"Must be one of: {', '.join(sorted(VALID_PATTERN_TYPES))}"})
    if tnr_status is not None and tnr_status not in VALID_TNR_STATUSES:
        errors.append({"field": "tnr_status", "message": f"Must be one of: {', '.join(sorted(VALID_TNR_STATUSES))}"})

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
```

- [ ] **Step 2: Verify the module imports cleanly**

Run: `cd backend && python -c "from app.api.cats import router; print('ok')"`
Expected: prints "ok"

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/cats.py
git commit -m "feat: add cats API router with list and detail endpoints"
```

---

### Task 4: Wire Up Main App and Verification

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Register map and cats routers**

Edit `backend/app/main.py` to add:

```python
from app.api.cats import router as cats_router
from app.api.map import router as map_router
```

And add to router registrations:

```python
app.include_router(map_router)
app.include_router(cats_router)
```

- [ ] **Step 2: Verify app starts**

Run: `cd backend && python -c "from app.main import app; print('ok')"`
Expected: prints "ok"

- [ ] **Step 3: Run linter**

Run: `cd backend && ruff check .`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: wire up map and cats routers"
```
