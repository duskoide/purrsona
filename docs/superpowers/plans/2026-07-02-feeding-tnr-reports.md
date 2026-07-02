# Feeding Spots, TNR Records, Content Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build endpoints for feeding spot creation, TNR record creation with optional status change, and content reporting.

**Architecture:** Service layer handles coordinate blurring, TNR status updates (in transaction), and content validation. Single API router exposes all three endpoints. TNR status changes require verified role; all other operations require signed-in role.

**Tech Stack:** Python 3.11, FastAPI, asyncpg

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `backend/app/services/feeding_service.py` | Create | Feeding spot, TNR record, report logic |
| `backend/app/api/feeding.py` | Create | API router for all three endpoints |
| `backend/app/main.py` | Modify | Register feeding router |

---

### Task 1: Feeding Service

**Files:**
- Create: `backend/app/services/feeding_service.py`

- [ ] **Step 1: Create feeding service with all three functions**

```python
# backend/app/services/feeding_service.py

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
    """Create a TNR record. If status_change provided and user is verified, also update cat TNR status.

    Raises 403 if non-verified user attempts status_change.
    Raises 404 if cat not found.
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

    async with db.acquire() as conn:
        async with conn.transaction():
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


VALID_CONTENT_TYPES = {"sighting", "feeding_spot", "tnr_record"}
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
                details=[{"field": "content_type", "message": f"Must be one of: {', '.join(sorted(VALID_CONTENT_TYPES))}"}],
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
```

- [ ] **Step 2: Verify the module imports cleanly**

Run: `cd backend && python -c "from app.services.feeding_service import create_feeding_spot, create_tnr_record, create_report; print('ok')"`
Expected: prints "ok"

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/feeding_service.py
git commit -m "feat: add feeding service with spot, TNR record, and report creation"
```

---

### Task 2: Feeding API Router

**Files:**
- Create: `backend/app/api/feeding.py`

- [ ] **Step 1: Create feeding router with all three endpoints**

```python
# backend/app/api/feeding.py

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.error_handlers import error_response
from app.core.rbac import require_role
from app.db.pool import get_db
from app.models.user import User, UserRole
from app.services.feeding_service import (
    VALID_CONTENT_TYPES,
    VALID_REASONS,
    create_feeding_spot,
    create_report,
    create_tnr_record,
)

VALID_TNR_STATUSES = {
    "unassessed", "needs_tnr", "scheduled", "in_progress", "completed", "ear_tipped",
}

router = APIRouter(prefix="/api/v1", tags=["feeding", "tnr", "reports"])


class FeedingSpotRequest(BaseModel):
    latitude: float
    longitude: float
    details: dict[str, Any]


@router.post("/feeding-spots", status_code=201)
async def feeding_spot_endpoint(
    body: FeedingSpotRequest,
    user: User = Depends(require_role(UserRole.SIGNED_IN)),
    db: asyncpg.Pool = Depends(get_db),
) -> dict[str, Any]:
    """Create a feeding spot."""
    errors = []
    if not (-90 <= body.latitude <= 90):
        errors.append({"field": "latitude", "message": "Must be between -90 and 90"})
    if not (-180 <= body.longitude <= 180):
        errors.append({"field": "longitude", "message": "Must be between -180 and 180"})
    if errors:
        raise HTTPException(
            status_code=422,
            detail=error_response(422, "Invalid parameters", details=errors),
        )

    return await create_feeding_spot(db, user.id, body.latitude, body.longitude, body.details)


class TnrRecordRequest(BaseModel):
    cat_id: UUID
    content: str
    status_change: str | None = None


@router.post("/tnr-records", status_code=201)
async def tnr_record_endpoint(
    body: TnrRecordRequest,
    user: User = Depends(require_role(UserRole.SIGNED_IN)),
    db: asyncpg.Pool = Depends(get_db),
) -> dict[str, Any]:
    """Create a TNR record. Status change requires verified role."""
    if body.status_change is not None and body.status_change not in VALID_TNR_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=error_response(
                422,
                "Invalid parameters",
                details=[{"field": "status_change", "message": f"Must be one of: {', '.join(sorted(VALID_TNR_STATUSES))}"}],
            ),
        )

    return await create_tnr_record(
        db=db,
        user_id=user.id,
        cat_id=str(body.cat_id),
        content=body.content,
        status_change=body.status_change,
        is_verified=user.role == UserRole.VERIFIED,
    )


class ReportRequest(BaseModel):
    content_type: str
    content_id: UUID
    reason: str
    details: str | None = None


@router.post("/reports", status_code=201)
async def report_endpoint(
    body: ReportRequest,
    user: User = Depends(require_role(UserRole.SIGNED_IN)),
    db: asyncpg.Pool = Depends(get_db),
) -> dict[str, str]:
    """Report content for moderation."""
    errors = []
    if body.content_type not in VALID_CONTENT_TYPES:
        errors.append({"field": "content_type", "message": f"Must be one of: {', '.join(sorted(VALID_CONTENT_TYPES))}"})
    if body.reason not in VALID_REASONS:
        errors.append({"field": "reason", "message": f"Must be one of: {', '.join(sorted(VALID_REASONS))}"})
    if errors:
        raise HTTPException(
            status_code=422,
            detail=error_response(422, "Invalid parameters", details=errors),
        )

    return await create_report(
        db=db,
        reporter_id=user.id,
        content_type=body.content_type,
        content_id=str(body.content_id),
        reason=body.reason,
        details=body.details,
    )
```

- [ ] **Step 2: Verify the module imports cleanly**

Run: `cd backend && python -c "from app.api.feeding import router; print('ok')"`
Expected: prints "ok"

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/feeding.py
git commit -m "feat: add feeding API router with spot, TNR record, and report endpoints"
```

---

### Task 3: Wire Up Main App and Verification

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Register feeding router**

Edit `backend/app/main.py` to add:

```python
from app.api.feeding import router as feeding_router
```

And add to router registrations:

```python
app.include_router(feeding_router)
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
git commit -m "feat: wire up feeding router"
```
