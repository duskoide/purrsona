# Cat Profile Editing Design

Date: 2026-07-02
Status: Approved for implementation

## Summary

Backend PATCH endpoint for cat metadata updates and frontend edit form. Any signed-in user can edit cat profile metadata (name, coat, pattern, size, ear tip, markings). Photos and TNR status have separate flows.

## Scope

**In scope:**
- `PATCH /api/v1/cats/{cat_id}` — backend endpoint for metadata updates
- `backend/app/services/cat_service.py` — cat update logic
- `/cats/[cat_id]/edit` page — frontend edit form
- "EDIT" button on cat profile page (signed-in users only)

**Out of scope:**
- Photo upload/editing (separate feature)
- TNR status changes (handled via TNR records)
- Cat deletion

## Backend

### PATCH /api/v1/cats/{cat_id}

Auth: `signed_in` role required.

Request: JSON body with optional fields:

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Nullable, "Unknown" is display-layer fallback |
| `coat_color` | string | Must be valid enum value |
| `pattern_type` | string | Must be valid enum value |
| `body_size` | string | Must be valid enum value |
| `ear_tip_status` | boolean | |
| `notable_markings` | string | Nullable |

Only provided fields are updated (partial update).

Response (200): Updated cat profile dict.

Error responses:
- 404: Cat not found
- 422: Invalid enum value

### Service Layer

File: `backend/app/services/cat_service.py`

```python
async def update_cat_profile(
    db: asyncpg.Pool,
    cat_id: str,
    updates: dict,
) -> dict | None:
```

Builds dynamic UPDATE query from provided fields. Returns updated profile or None (404).

## Frontend

### /cats/[cat_id]/edit

- Wrapped in `ProtectedRoute`
- Fetches current cat data from GET /api/v1/cats/{id}
- Pre-fills form fields
- Same dropdown pattern as sighting wizard (coat, pattern, size)
- TextInput for name and notable_markings
- Checkbox for ear_tip_status
- Save → PATCH /api/v1/cats/{id} → redirect to /cats/{id}
- Cancel → back to /cats/{id}

### Edit Button on Cat Profile

Add "EDIT" button on `/cats/[cat_id]` page, visible to signed-in users. Links to `/cats/{id}/edit`.

## Files to Create/Modify

| File | Action |
|------|--------|
| `backend/app/services/cat_service.py` | Create — cat update logic |
| `backend/app/api/cats.py` | Modify — add PATCH endpoint |
| `frontend/src/app/cats/[cat_id]/edit/page.tsx` | Create — edit form page |
| `frontend/src/app/cats/[cat_id]/page.tsx` | Modify — add EDIT button |

## Design System Compliance

- VT323 font, 0px corners, hard shadows
- Button press behavior
- Focus-visible on all inputs
- prefers-reduced-motion fallbacks
