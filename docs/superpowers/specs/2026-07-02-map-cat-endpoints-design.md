# Map & Cat Endpoints Design

Date: 2026-07-02
Status: Approved for implementation

## Summary

Three public API endpoints for browsing map data and cat profiles: a map markers endpoint using PostGIS bounding box queries, a paginated cat list with filters, and a full cat profile endpoint with computed status_tags and sighting history.

## Scope

**In scope:**
- `GET /api/v1/map` — map markers for viewport (sightings + feeding spots)
- `GET /api/v1/cats` — paginated cat list with optional filters
- `GET /api/v1/cats/{cat_id}` — full cat profile with history
- Service layer for map queries and cat profile assembly
- Wiring into main.py

**Out of scope:**
- Frontend map UI (Leaflet integration)
- Feeding spot CRUD
- Cat profile editing
- TNR record creation
- Map clustering (client-side concern)

## Endpoints

### GET /api/v1/map

Auth: none (public).

Query params:

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `min_lat` | float | yes | South bound |
| `min_lng` | float | yes | West bound |
| `max_lat` | float | yes | North bound |
| `max_lng` | float | yes | East bound |

Query: PostGIS `ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)` on `blurred_location` for both `sightings` and `feeding_spots`. Uses existing GIST indexes.

Response (200):
```json
{
  "sightings": [
    {
      "id": "uuid",
      "blurred_location": { "latitude": 40.7129, "longitude": -74.0061 },
      "observed_at": "2026-06-28T10:30:00Z",
      "condition_tags": ["healthy", "friendly"],
      "cat": {
        "id": "uuid",
        "name": "Whiskers",
        "tnr_status": "completed",
        "coat_color": "orange",
        "pattern_type": "tabby"
      }
    }
  ],
  "feeding_spots": [
    {
      "id": "uuid",
      "blurred_location": { "latitude": 40.7131, "longitude": -74.0066 },
      "details": { "description": "Under the red awning", "schedule": "Daily 7am and 6pm" }
    }
  ]
}
```

Validation:
- All four bbox params required
- `min_lat < max_lat`, `min_lng < max_lng`
- Latitude range: -90 to 90
- Longitude range: -180 to 180

### GET /api/v1/cats

Auth: none (public).

Query params:

| Param | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `page` | int | no | 1 | 1-indexed |
| `per_page` | int | no | 20 | Max 100 |
| `coat_color` | str | no | — | Filter by enum value |
| `pattern_type` | str | no | — | Filter by enum value |
| `tnr_status` | str | no | — | Filter by enum value |

Response (200):
```json
{
  "cats": [
    {
      "id": "uuid",
      "name": "Whiskers",
      "tnr_status": "completed",
      "coat_color": "orange",
      "pattern_type": "tabby",
      "ear_tip_status": true,
      "latest_photo": "http://minio:9000/purrsona-images/photos/abc.jpg"
    }
  ],
  "total": 42,
  "page": 1,
  "per_page": 20
}
```

- `name` falls back to `"Unknown"` when NULL (decisions doc #12)
- `latest_photo`: first photo from the most recent sighting, or first photo from `cat.photos` if no sightings
- Count query for total (separate or CTE)

### GET /api/v1/cats/{cat_id}

Auth: none (public).

Path params: `cat_id` (UUID)

Response (200):
```json
{
  "id": "uuid",
  "name": "Whiskers",
  "photos": ["http://minio:9000/photos/abc.jpg"],
  "tnr_status": "completed",
  "coat_color": "orange",
  "pattern_type": "tabby",
  "notable_markings": "white chest",
  "ear_tip_status": true,
  "body_size": "medium",
  "status_tags": ["healthy", "friendly", "eating"],
  "sighting_history": [
    {
      "id": "uuid",
      "blurred_location": { "latitude": 40.7129, "longitude": -74.0061 },
      "observed_at": "2026-06-28T10:30:00Z",
      "condition_tags": ["healthy", "friendly"],
      "photo_url": "http://minio:9000/photos/abc.jpg",
      "notes": "Spotted near the park bench"
    }
  ],
  "tnr_records": [
    {
      "id": "uuid",
      "status_change": "completed",
      "notes": "Trapped on Jan 15, taken to clinic",
      "created_at": "2026-06-01T09:00:00Z"
    }
  ]
}
```

- `status_tags`: computed at read time as aggregated, deduplicated union of `condition_tags` across all confirmed sightings (decisions doc #15)
- `sighting_history`: ordered by `observed_at DESC`, blurred_location only (never exact)
- `tnr_records`: ordered by `created_at DESC`
- 404 if cat not found

## Service Layer

File: `backend/app/services/map_service.py`

### get_map_markers

```python
async def get_map_markers(
    db: asyncpg.Pool,
    min_lat: float,
    min_lng: float,
    max_lat: float,
    max_lng: float,
) -> dict[str, list]:
```

Two queries (or UNION):
1. Sightings joined with cat_profiles, filtered by `ST_MakeEnvelope` on `blurred_location`
2. Feeding spots filtered by same bbox

### list_cats

```python
async def list_cats(
    db: asyncpg.Pool,
    page: int,
    per_page: int,
    coat_color: str | None,
    pattern_type: str | None,
    tnr_status: str | None,
) -> dict[str, Any]:
```

Returns `{ cats, total, page, per_page }`.

### get_cat_profile

```python
async def get_cat_profile(
    db: asyncpg.Pool,
    cat_id: str,
) -> dict[str, Any] | None:
```

Returns full profile dict or None (404). Assembles:
- Cat profile fields
- Computed status_tags from sightings
- Sighting history
- TNR records

## Files to Create/Modify

| File | Action |
|------|--------|
| `backend/app/services/map_service.py` | Create — map queries and cat profile assembly |
| `backend/app/api/cats.py` | Create — API router for /cats endpoints |
| `backend/app/api/map.py` | Create — API router for /map endpoint |
| `backend/app/main.py` | Modify — register cats and map routers |

## Properties (from spec/decisions doc)

- Decision #7: Response serializers NEVER include exact `location` — only `blurred_location`
- Decision #12: Cat name nullable, "Unknown" is display-layer fallback
- Decision #15: status_tags computed from condition_tags, no new column
- Spec: Public browsing is open to everyone (no auth required)
- Spec: Public map markers use blurred locations
