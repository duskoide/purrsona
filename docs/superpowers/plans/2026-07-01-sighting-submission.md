# Sighting Submission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement two-step sighting lifecycle: initiate (photo + metadata → draft + matches) and confirm (pick cat or "none of these" → confirmed sighting).

**Architecture:** Sighting service handles draft creation, confirmation, and cat profile creation. Two API endpoints (initiate, confirm) expose the flow. Lazy draft expiration (check on read, 410 Gone). Metadata + embedding copied to new cat on "none of these."

**Tech Stack:** Python 3.11, FastAPI, asyncpg, existing services (image_service, embedding_service, coordinate_service)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `backend/app/services/sighting_service.py` | Create | Sighting lifecycle: initiate, confirm, create cat from draft |
| `backend/app/api/sightings.py` | Create | API router with POST /initiate and POST /confirm |
| `backend/app/main.py` | Modify | Register sightings router |

---

### Task 1: Sighting Service

**Files:**
- Create: `backend/app/services/sighting_service.py`

- [ ] **Step 1: Create sighting service with initiate_sighting**

```python
# backend/app/services/sighting_service.py

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import asyncpg

from app.core.error_handlers import error_response
from app.core.rbac import require_role
from app.services.coordinate_service import blur_coordinate
from app.services.embedding_service import embedding_service
from app.services.image_service import upload_image
from fastapi import HTTPException, UploadFile


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

    if draft["draft_expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=410,
            detail=error_response(410, "Draft expired"),
        )

    if cat_id is not None:
        cat = await db.fetchrow(
            "SELECT id FROM cat_profiles WHERE id = $1",
            cat_id,
        )
        if cat is None:
            raise HTTPException(
                status_code=404,
                detail=error_response(404, "Cat profile not found"),
            )
    else:
        cat_id = await _create_cat_from_draft(db, draft, user_id)

    sighting_id = str(uuid4())
    await db.execute(
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

    await db.execute("DELETE FROM sighting_drafts WHERE id = $1", draft_id)

    return {"sighting_id": sighting_id, "cat_profile_id": cat_id}


async def _create_cat_from_draft(
    db: asyncpg.Pool,
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

    await db.execute(
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
        draft["ear_tip_status"],
        draft["body_size"],
        embedding_str,
        user_id,
    )

    return cat_id
```

- [ ] **Step 2: Verify the module imports cleanly**

Run: `cd backend && python -c "from app.services.sighting_service import initiate_sighting, confirm_sighting; print('ok')"`
Expected: prints "ok"

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/sighting_service.py
git commit -m "feat: add sighting service with initiate and confirm flows"
```

---

### Task 2: Sightings API Router

**Files:**
- Create: `backend/app/api/sightings.py`

- [ ] **Step 1: Create sightings router with initiate and confirm endpoints**

```python
# backend/app/api/sightings.py

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
```

- [ ] **Step 2: Verify the module imports cleanly**

Run: `cd backend && python -c "from app.api.sightings import router; print('ok')"`
Expected: prints "ok"

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/sightings.py
git commit -m "feat: add sightings API router with initiate and confirm endpoints"
```

---

### Task 3: Wire Up Main App and Verification

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Register sightings router**

Edit `backend/app/main.py` to add:

```python
from app.api.sightings import router as sightings_router
```

And add to router registrations:

```python
app.include_router(sightings_router)
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
git commit -m "feat: wire up sightings router"
```

- [ ] **Step 5: Final verification**

Run: `cd backend && python -c "from app.main import app; from app.api.sightings import router; print('all imports ok')"`
Expected: prints "all imports ok"
