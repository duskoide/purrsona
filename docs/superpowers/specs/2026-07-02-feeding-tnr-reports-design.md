# Feeding Spots, TNR Records, Content Reports Design

Date: 2026-07-02
Status: Approved for implementation

## Summary

Three endpoints for community coordination: feeding spot creation (signed-in), TNR record creation with optional status change (verified users can update cat TNR status), and content reporting (signed-in, report-only for v1).

## Scope

**In scope:**
- `POST /api/v1/feeding-spots` — create feeding spot
- `POST /api/v1/tnr-records` — create TNR record, optionally update cat TNR status
- `POST /api/v1/reports` — report content
- Service layer for all three
- Wiring into main.py

**Out of scope:**
- Admin report review endpoints (v1 is report-only)
- Feeding spot CRUD (update/delete)
- TNR record editing
- Frontend UI

## Endpoints

### POST /api/v1/feeding-spots

Auth: `signed_in` role required.

Request: JSON body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `latitude` | float | yes | Exact coordinate (stored, never exposed) |
| `longitude` | float | yes | Exact coordinate (stored, never exposed) |
| `details` | object | yes | Freeform JSONB (any keys) |

Flow:
1. Validate coordinate ranges
2. Blur coordinates via `coordinate_service.blur_coordinate()`
3. Insert into `feeding_spots`
4. Return spot with blurred_location

Response (201):
```json
{
  "id": "uuid",
  "blurred_location": { "latitude": 40.7131, "longitude": -74.0066 },
  "details": { "description": "Under the red awning", "schedule": "Daily 7am" }
}
```

### POST /api/v1/tnr-records

Auth: `signed_in` role required.

Request: JSON body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `cat_id` | UUID | yes | Must reference existing cat |
| `content` | string | yes | Free text description |
| `status_change` | string | no | tnr_status_enum value. If provided and user is verified, also updates cat_profiles.tnr_status |

Flow:
1. Verify cat exists (404 if not)
2. Insert TNR record
3. If `status_change` provided AND user role is `verified`:
   - Update `cat_profiles.tnr_status` to the new value
4. If `status_change` provided but user is NOT verified:
   - Reject with 403 (status changes require verified role)
5. Return record

Response (201):
```json
{
  "id": "uuid",
  "cat_id": "uuid",
  "status_change": "completed"
}
```

Error responses:
- 404: Cat not found
- 403: Status change requires verified role
- 422: Invalid status_change enum value

### POST /api/v1/reports

Auth: `signed_in` role required.

Request: JSON body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `content_type` | string | yes | "sighting", "feeding_spot", or "tnr_record" |
| `content_id` | UUID | yes | Must reference existing content |
| `reason` | string | yes | "inaccurate", "abusive", "unsafe", or "other" |
| `details` | string | no | Optional explanation |

Flow:
1. Validate content_type and reason enums
2. Verify content exists (404 if not) — query the appropriate table based on content_type
3. Insert report
4. Return report ID

Response (201):
```json
{
  "id": "uuid"
}
```

## Service Layer

File: `backend/app/services/feeding_service.py`

### create_feeding_spot

```python
async def create_feeding_spot(
    db: asyncpg.Pool,
    user_id: str,
    latitude: float,
    longitude: float,
    details: dict,
) -> dict:
```

### create_tnr_record

```python
async def create_tnr_record(
    db: asyncpg.Pool,
    user_id: str,
    cat_id: str,
    content: str,
    status_change: str | None,
    is_verified: bool,
) -> dict:
```

### create_report

```python
async def create_report(
    db: asyncpg.Pool,
    reporter_id: str,
    content_type: str,
    content_id: str,
    reason: str,
    details: str | None,
) -> dict:
```

## Transaction Safety

- `create_tnr_record`: TNR insert + cat status update wrapped in single transaction (atomic).
- `create_feeding_spot`: single insert, no transaction needed.
- `create_report`: single insert, no transaction needed.

## Files to Create/Modify

| File | Action |
|------|--------|
| `backend/app/services/feeding_service.py` | Create — feeding spot, TNR record, report logic |
| `backend/app/api/feeding.py` | Create — API router for all three endpoints |
| `backend/app/main.py` | Modify — register feeding router |

## Properties (from spec/decisions doc)

- Decision #7: Exact coords stored, never exposed in API responses — only blurred_location
- Spec: Feeding spots created by any signed-in user
- Spec: TNR records created by any signed-in user; TNR status changes require verified role
- Spec: Publish-first model, report-only moderation for v1
- Spec: report_reason enum: inaccurate, abusive, unsafe, other
