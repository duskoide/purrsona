# Frontend Sighting Wizard Design

Date: 2026-07-02
Status: Approved for implementation

## Summary

4-step wizard for submitting cat sightings: photo upload, location picker (map click), cat description with condition tags, and match review with confirmation. Authenticated users only.

## Scope

**In scope:**
- `/sightings/new` page with 4-step wizard
- ImageUpload component (file input + preview)
- LocationPicker component (MapContainer + click-to-pin)
- TagSelector component (condition tag checkboxes)
- SightingWizard step manager with progress indicator
- Submit to POST /sightings/initiate, then POST /sightings/confirm
- NavigationBar link for "REPORT SIGHTING"

**Out of scope:**
- Cat profile editing
- Feeding spot creation
- TNR record creation
- Offline support

## Route

`/sightings/new` — wrapped in `ProtectedRoute` (redirects to `/auth/login` if unauthenticated).

## Wizard Steps

### Step 1: Photo Upload

- File input accepting JPEG, PNG, WebP
- Image preview after upload
- Client-side validation: file type, max size (10MB)
- Next button disabled until image selected

### Step 2: Location

- Map with click-to-pin interaction
- Reuses MapContainer component with added `onClick` callback
- Marker placed at clicked location (drag to adjust)
- Lat/lng coordinates displayed below map
- Next button disabled until location selected

### Step 3: Cat Description

Form fields:
- **Coat color**: dropdown (black, white, orange, gray, brown, cream, mixed_black_white, mixed_orange_white, other)
- **Pattern type**: dropdown (tabby, calico, tuxedo, solid, bicolor, tortoiseshell, pointed, other)
- **Body size**: dropdown (small, medium, large) — optional
- **Ear tip status**: checkbox — optional
- **Notable markings**: text input — optional
- **Observed at**: datetime-local input — required
- **Condition tags**: checkboxes (healthy, friendly, skittish, injured, hiding, eating, other) — at least one required
- **Notes**: textarea — optional

### Step 4: Review & Confirm

- Shows photo thumbnail
- Shows location on mini map
- Shows entered metadata summary
- Submit button triggers:
  1. POST multipart to `/api/v1/sightings/initiate`
  2. Shows match candidates (up to 3) with cat name, similarity, coat/pattern
  3. User selects one candidate or "none of these"
  4. POST JSON to `/api/v1/sightings/confirm`
  5. Redirects to `/cats/{cat_profile_id}`

## Components to Create

### ImageUpload

```typescript
interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  preview: string | null;
}
```

### LocationPicker

Extends MapContainer with click-to-pin.

```typescript
interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  selectedLocation: [number, number] | null;
}
```

### TagSelector

```typescript
interface TagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}
```

### SightingWizard

Step manager with progress indicator and navigation.

## Files to Create/Modify

| File | Action |
|------|--------|
| `frontend/src/app/sightings/new/page.tsx` | Create — wizard page |
| `frontend/src/components/ImageUpload.tsx` | Create — file input with preview |
| `frontend/src/components/LocationPicker.tsx` | Create — map with click-to-pin |
| `frontend/src/components/TagSelector.tsx` | Create — condition tag checkboxes |
| `frontend/src/components/SightingWizard.tsx` | Create — step manager |
| `frontend/src/components/NavigationBar.tsx` | Modify — add "REPORT SIGHTING" link |
| `frontend/src/components/MapContainer.tsx` | Modify — add onClick prop |

## Design System Compliance

- VT323 font on all text
- 0px corners on cards, panels, inputs
- Hard offset block shadows
- Button press behavior (hover lifts, active compresses)
- Status badges with text labels
- Focus-visible on all interactive elements
- prefers-reduced-motion fallbacks
