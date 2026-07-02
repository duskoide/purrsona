# Sighting Submission Design

Date: 2026-07-01
Status: Approved for implementation

## Summary

The sighting submission feature implements the two-step sighting lifecycle: initiate (upload photo + metadata → create draft + find cat matches) and confirm (user picks a cat or "none of these" → create confirmed sighting). Drafts expire after 30 minutes (lazy expiration on read). When user selects "none of these," a new cat profile is created with the draft's metadata and embedding copied over.

## Scope

**In scope:**
- `POST /api/v1/sightings/initiate` — multipart form: image + metadata → draft + matches
- `POST /api/v1/sightings/confirm` — JSON: draft_id + cat_id (or null) → confirmed sighting
- Sighting service layer (initiate, confirm, create cat from draft)
- Lazy draft expiration (check on read, return 410 Gone)
- Metadata + embedding copy on "none of these" (decisions doc #11)
- Wiring sightings router into main.py

**Out of scope:**
- Draft cleanup background task (lazy expiration only)
- Progressive relaxation in matching (keep single-pass, add later if needed)
- Frontend UI
- `GET /sightings` listing endpoint
- `GET /sightings/{id}` detail endpoint

## Endpoints

### POST /api/v1/sightings/initiate

Auth: `signed_in` role required.

Request: multipart form

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `image` | file | yes | Validated by magic bytes + size (existing `image_service`) |
| `latitude` | float | yes | Exact coordinate (stored but never exposed) |
| `longitude` | float | yes | Exact coordinate (stored but never exposed) |
| `observed_at` | ISO 8601 string | yes | When the sighting occurred |
| `condition_tags` | JSON string | yes | Array of strings, e.g. `["healthy", "friendly"]` |
| `coat_color` | string | yes | Must be valid `coat_color_enum` value |
| `pattern_type` | string | yes | Must be valid `pattern_type_enum` value |
| `notable_markings` | string | no | Free text |
| `ear_tip_status` | boolean | no | Whether cat is ear-tipped |
| `body_size` | string | no | Must be valid `body_size_enum` value |
| `notes` | string | no | Optional free-text notes |

Flow:
1. Validate image (magic bytes + size)
2. Upload image to S3 via `image_service.upload_image()`
3. Blur coordinates via `coordinate_service.blur_coordinate()`
4. Validate enum fields (coat_color, pattern_type, body_size)
5. Extract embedding via `embedding_service.extract_embedding()`
6. Find matches via `embedding_service.find_matches(db, embedding, coat_color, pattern_type)`
7. Insert draft into `sighting_drafts` table
8. Return draft ID + blurred location + candidates

Response (201):
```json
{
  "draft_id": "uuid",
  "photo_url": "http://minio:9000/purrsona-images/photos/abc.jpg",
  "blurred_location": { "latitude": 1.35, "longitude": 103.82 },
  "candidates": [
    {
      "cat_id": "uuid",
      "name": "Whiskers",
      "similarity": 0.82,
      "coat_color": "orange",
      "pattern_type": "tabby",
      "notable_markings": "white chest"
    }
  ]
}
```

### POST /api/v1/sightings/confirm

Auth: `signed_in` role required.

Request: JSON body
```json
{
  "draft_id": "uuid",
  "cat_id": "uuid-or-null"
}
```

- `cat_id = null` means "none of these" → create new cat profile
- `cat_id = "uuid"` means user selected an existing cat

Flow:
1. Fetch draft by ID (404 if not found)
2. Check draft expiration (410 Gone if `draft_expires_at < NOW()`)
3. Verify user owns the draft (403 if not)
4. If `cat_id` provided:
   - Verify cat profile exists (404 if not)
   - Insert confirmed sighting linked to that cat
5. If `cat_id` is null ("none of these"):
   - Create new cat profile with draft's metadata + embedding (decisions doc #11)
   - Insert confirmed sighting linked to new cat
6. Delete draft
7. Return sighting ID + cat profile ID

Response (201):
```json
{
  "sighting_id": "uuid",
  "cat_profile_id": "uuid"
}
```

Error responses:
- 404: Draft not found or cat not found
- 410: Draft expired
- 403: Not draft owner

## Service Layer

File: `backend/app/services/sighting_service.py`

### initiate_sighting

```python
async def initiate_sighting(
    db: asyncpg.Pool,
    user_id: str,
    image_bytes: bytes,
    content_type: str | None,
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
) -> dict:
```

### confirm_sighting

```python
async def confirm_sighting(
    db: asyncpg.Pool,
    user_id: str,
    draft_id: str,
    cat_id: str | None,
) -> dict:
```

### _create_cat_from_draft

```python
async def _create_cat_from_draft(
    db: asyncpg.Pool,
    draft: asyncpg.Record,
) -> str:
```

Copies: `coat_color`, `pattern_type`, `notable_markings`, `ear_tip_status`, `body_size`, `embedding`. Sets `created_by` to the confirming user. Name is NULL (per decisions doc #12).

## Transaction Safety

- `initiate_sighting`: single transaction for draft insert. S3 upload happens before the transaction — if DB insert fails, S3 has an orphaned object (acceptable for v1).
- `confirm_sighting`: single transaction for sighting insert + cat creation (if "none of these") + draft deletion. All-or-nothing.

## Files to Create/Modify

| File | Action |
|------|--------|
| `backend/app/services/sighting_service.py` | Create — sighting lifecycle logic |
| `backend/app/api/sightings.py` | Create — API router with initiate + confirm endpoints |
| `backend/app/main.py` | Modify — register sightings router |

## Properties (from spec/decisions doc)

- Property 10: Matching is advisory only, user must confirm (enforced by two-step flow)
- Property 24: Copy sighting metadata to new cat on "none of these" (decision #11)
- Decision #12: Cat name nullable, "Unknown" is display-layer only
- Decision #7: Exact coords stored, never exposed in API responses
- Decision #15: status_tags computed from condition_tags, no new column
