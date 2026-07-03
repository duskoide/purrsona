# Frontend Feeding, TNR, Reports Design

Date: 2026-07-02
Status: Approved for implementation

## Summary

Frontend forms for creating feeding spots (separate page), TNR records (modal on cat profile), and content reports (modal with report buttons). All authenticated actions.

## Scope

**In scope:**
- `/feeding-spots/new` page — feeding spot creation with location picker
- TNR record modal on cat profile page
- Report modal with report buttons on content cards
- New components: TnrRecordModal, ReportModal

**Out of scope:**
- Feeding spot editing/deletion
- TNR record editing
- Report admin review

## Feeding Spot Form

### Route: `/feeding-spots/new`

Behind `ProtectedRoute`.

Form fields:
- **Location**: LocationPicker component (map click-to-pin)
- **Details**: textarea for freeform JSON (e.g., `{"description": "...", "schedule": "...", "food_type": "..."}`)

Submit → POST /api/v1/feeding-spots (JSON body) → redirect to `/map`

## TNR Record Modal

### On `/cats/[cat_id]` page

- "Add TNR Record" button (visible to signed-in users)
- Opens Modal component with:
  - **Content**: textarea (required)
  - **Status change**: dropdown with TNR statuses (only enabled for verified users)
- Submit → POST /api/v1/tnr-records → close modal, refresh page

## Report Modal

### Report buttons on content

- "Report" button on sighting cards in cat profile history
- "Report" button on TNR record cards in cat profile
- Opens Modal component with:
  - **Reason**: dropdown (inaccurate, abusive, unsafe, other)
  - **Details**: textarea (optional)
- Submit → POST /api/v1/reports → close modal, show success toast

## Components to Create

### TnrRecordModal

```typescript
interface TnrRecordModalProps {
  catId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
```

### ReportModal

```typescript
interface ReportModalProps {
  contentType: string;
  contentId: string;
  open: boolean;
  onClose: () => void;
}
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `frontend/src/app/feeding-spots/new/page.tsx` | Create — feeding spot form |
| `frontend/src/components/TnrRecordModal.tsx` | Create — TNR record modal |
| `frontend/src/components/ReportModal.tsx` | Create — report modal |
| `frontend/src/app/cats/[cat_id]/page.tsx` | Modify — add TNR button + report buttons |
| `frontend/src/components/NavigationBar.tsx` | Modify — add FEEDING SPOTS link |

## Design System Compliance

- VT323 font, 0px corners, hard shadows
- Button press behavior
- Focus-visible on all inputs
- prefers-reduced-motion fallbacks
