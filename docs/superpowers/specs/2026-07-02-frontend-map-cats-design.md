# Frontend Map & Cats Design

Date: 2026-07-02
Status: Approved for implementation

## Summary

Three public pages for browsing map data and cat profiles: an interactive Leaflet map with sighting/feeding spot markers, a paginated cat list with filters, and a full cat profile page with sighting history and TNR records.

## Scope

**In scope:**
- `/map` page — interactive Leaflet map with markers from GET /api/v1/map
- `/cats` page — paginated cat list with filter dropdowns
- `/cats/[cat_id]` page — full cat profile with history
- Leaflet + react-leaflet installation
- New components: MapContainer, CatCard, FilterBar
- Navigation links in NavigationBar

**Out of scope:**
- Sighting submission wizard (separate feature)
- Cat profile editing (separate feature)
- Map clustering (future enhancement)
- Offline support

## Pages

### /map — Interactive Map

Public (no auth required).

- Full-viewport Leaflet map with OpenStreetMap tiles
- Default view: center on seed data area (NYC ~40.7128, -74.006), zoom 14
- Fetches markers from `GET /api/v1/map?min_lat=&min_lng=&max_lat=&max_lng=` on viewport change
- Debounced requests (300ms) to avoid excessive API calls during pan/zoom
- Sighting markers: popup with cat name (fallback "Unknown"), TNR status badge, coat color, pattern type, link to `/cats/{cat_id}`
- Feeding spot markers: popup with details JSON displayed as text
- Different marker icons for sightings vs feeding spots
- Dynamic import for Leaflet components (SSR disabled — Leaflet uses window/document)
- Loading state: PixelSpinner while map initializes

### /cats — Cat List

Public (no auth required).

- Card grid layout (3 columns on desktop, 2 on tablet, 1 on mobile)
- Each CatCard:
  - Photo (from `latest_photo`, fallback placeholder)
  - Name (fallback "Unknown")
  - TNR status badge
  - Coat color + pattern type text
  - Click navigates to `/cats/{id}`
- Filter bar at top: dropdowns for coat_color, pattern_type, tnr_status
- Pagination: prev/next buttons with page counter
- Empty state: EmptyState component when no cats match filters
- Loading state: PixelSpinner while fetching

### /cats/[cat_id] — Cat Profile

Public (no auth required).

- Hero section: photo (first from photos array), name, TNR status badge
- Metadata card: coat color, pattern type, body size, ear tip status, notable markings
- Status tags: badges computed from sighting condition_tags
- Sighting history: list of sighting cards with photo, blurred location, observed_at, condition tags, notes
- TNR records: list with status_change, content, created_at
- 404 state: EmptyState when cat not found

## Components to Create

### MapContainer

Dynamic wrapper for Leaflet map. Handles SSR compatibility.

```typescript
// frontend/src/components/MapContainer.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
```

### CatCard

Card component for cat list grid.

```typescript
// frontend/src/components/CatCard.tsx
interface CatCardProps {
  id: string;
  name: string;
  tnrStatus: string;
  coatColor: string;
  patternType: string;
  latestPhoto: string | null;
}
```

### FilterBar

Dropdown filters for cat list.

```typescript
// frontend/src/components/FilterBar.tsx
interface FilterBarProps {
  coatColor: string | null;
  patternType: string | null;
  tnrStatus: string | null;
  onChange: (filters: { coatColor?: string; patternType?: string; tnrStatus?: string }) => void;
}
```

## Navigation Updates

Add "MAP" and "CATS" links to NavigationBar (visible to all users, not just authenticated).

## New Dependencies

```
npm install leaflet react-leaflet @types/leaflet
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `frontend/src/app/map/page.tsx` | Create — map page |
| `frontend/src/app/cats/page.tsx` | Create — cat list page |
| `frontend/src/app/cats/[cat_id]/page.tsx` | Create — cat profile page |
| `frontend/src/components/MapContainer.tsx` | Create — Leaflet wrapper |
| `frontend/src/components/CatCard.tsx` | Create — cat list card |
| `frontend/src/components/FilterBar.tsx` | Create — filter dropdowns |
| `frontend/src/components/NavigationBar.tsx` | Modify — add MAP and CATS links |
| `frontend/package.json` | Modify — add leaflet deps |
| `frontend/next.config.js` | Modify — add image domains if needed |

## Design System Compliance

- VT323 font on all text
- 0px corners on cards, panels, inputs
- Hard offset block shadows
- Button press behavior (hover lifts, active compresses)
- Status badges with text labels (not color-only)
- Focus-visible on all interactive elements
- prefers-reduced-motion fallbacks
