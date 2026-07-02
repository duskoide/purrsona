# Frontend Map & Cats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build public map page with Leaflet markers, cat list page with filters, and cat profile detail page.

**Architecture:** Leaflet map with dynamic import (SSR disabled), fetching markers from GET /api/v1/map on viewport change. Cat list uses Card grid with filter dropdowns. Cat profile assembles data from GET /api/v1/cats/{id}.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Leaflet, react-leaflet

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `frontend/package.json` | Modify | Add leaflet, react-leaflet, @types/leaflet |
| `frontend/src/components/MapContainer.tsx` | Create | Leaflet map wrapper with dynamic import |
| `frontend/src/components/CatCard.tsx` | Create | Card for cat list grid |
| `frontend/src/components/FilterBar.tsx` | Create | Dropdown filters for cat list |
| `frontend/src/app/map/page.tsx` | Create | Map page |
| `frontend/src/app/cats/page.tsx` | Create | Cat list page |
| `frontend/src/app/cats/[cat_id]/page.tsx` | Create | Cat profile page |
| `frontend/src/components/NavigationBar.tsx` | Modify | Add MAP and CATS links |

---

### Task 1: Install Dependencies and MapContainer Component

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/components/MapContainer.tsx`

- [ ] **Step 1: Install Leaflet dependencies**

Run: `cd frontend && npm install leaflet react-leaflet @types/leaflet`

- [ ] **Step 2: Create MapContainer component**

```typescript
// frontend/src/components/MapContainer.tsx
"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapContainerProps {
  center: [number, number];
  zoom: number;
  onBoundsChange?: (bounds: {
    min_lat: number;
    min_lng: number;
    max_lat: number;
    max_lng: number;
  }) => void;
  children?: React.ReactNode;
}

export function MapContainer({ center, zoom, onBoundsChange, children }: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const map = L.map(mapRef.current).setView(center, zoom);
    leafletMapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    if (onBoundsChange) {
      const updateBounds = () => {
        const bounds = map.getBounds();
        onBoundsChange({
          min_lat: bounds.getSouth(),
          min_lng: bounds.getWest(),
          max_lat: bounds.getNorth(),
          max_lng: bounds.getEast(),
        });
      };

      map.on("moveend", updateBounds);
      updateBounds();
    }

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  return <div ref={mapRef} className="h-full w-full" />;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/src/components/MapContainer.tsx
git commit -m "feat: add Leaflet deps and MapContainer component"
```

---

### Task 2: CatCard and FilterBar Components

**Files:**
- Create: `frontend/src/components/CatCard.tsx`
- Create: `frontend/src/components/FilterBar.tsx`

- [ ] **Step 1: Create CatCard component**

```typescript
// frontend/src/components/CatCard.tsx
"use client";

import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { Card } from "./Card";

interface CatCardProps {
  id: string;
  name: string;
  tnrStatus: string;
  coatColor: string;
  patternType: string;
  latestPhoto: string | null;
}

const TNR_STATUS_MAP: Record<string, "verified" | "signed_in" | "pending"> = {
  completed: "verified",
  ear_tipped: "verified",
  needs_tnr: "pending",
  scheduled: "pending",
  in_progress: "pending",
  unassessed: "signed_in",
};

export function CatCard({ id, name, tnrStatus, coatColor, patternType, latestPhoto }: CatCardProps) {
  return (
    <Link href={`/cats/${id}`}>
      <Card variant="standard" className="hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex flex-col gap-3">
          {latestPhoto ? (
            <img
              src={latestPhoto}
              alt={name}
              className="w-full h-48 object-cover border-2 border-neutral-900"
            />
          ) : (
            <div className="w-full h-48 bg-neutral-100 border-2 border-neutral-900 flex items-center justify-center">
              <span className="text-neutral-500 text-lg">No photo</span>
            </div>
          )}
          <div className="flex flex-col gap-2 p-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">{name}</h3>
              <StatusBadge status={TNR_STATUS_MAP[tnrStatus] || "signed_in"} />
            </div>
            <p className="text-neutral-600">
              {coatColor} {patternType}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Create FilterBar component**

```typescript
// frontend/src/components/FilterBar.tsx
"use client";

const COAT_COLORS = [
  "black", "white", "orange", "gray", "brown",
  "cream", "mixed_black_white", "mixed_orange_white", "other",
];

const PATTERN_TYPES = [
  "tabby", "calico", "tuxedo", "solid", "bicolor",
  "tortoiseshell", "pointed", "other",
];

const TNR_STATUSES = [
  "unassessed", "needs_tnr", "scheduled", "in_progress", "completed", "ear_tipped",
];

interface FilterBarProps {
  coatColor: string | null;
  patternType: string | null;
  tnrStatus: string | null;
  onChange: (filters: { coatColor?: string | null; patternType?: string | null; tnrStatus?: string | null }) => void;
}

export function FilterBar({ coatColor, patternType, tnrStatus, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <select
        value={coatColor || ""}
        onChange={(e) => onChange({ coatColor: e.target.value || null })}
        className="border-2 border-neutral-900 bg-neutral-0 px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary-400"
      >
        <option value="">All coat colors</option>
        {COAT_COLORS.map((c) => (
          <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
        ))}
      </select>

      <select
        value={patternType || ""}
        onChange={(e) => onChange({ patternType: e.target.value || null })}
        className="border-2 border-neutral-900 bg-neutral-0 px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary-400"
      >
        <option value="">All patterns</option>
        {PATTERN_TYPES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      <select
        value={tnrStatus || ""}
        onChange={(e) => onChange({ tnrStatus: e.target.value || null })}
        className="border-2 border-neutral-900 bg-neutral-0 px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary-400"
      >
        <option value="">All TNR statuses</option>
        {TNR_STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CatCard.tsx frontend/src/components/FilterBar.tsx
git commit -m "feat: add CatCard and FilterBar components"
```

---

### Task 3: Map Page

**Files:**
- Create: `frontend/src/app/map/page.tsx`

- [ ] **Step 1: Create map page**

```typescript
// frontend/src/app/map/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { PixelSpinner } from "@/components/PixelSpinner";

const MapContainer = dynamic(
  () => import("@/components/MapContainer").then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <PixelSpinner label="Loading map..." /> }
);

interface Sighting {
  id: string;
  blurred_location: { latitude: number; longitude: number };
  observed_at: string;
  condition_tags: string[];
  cat: {
    id: string;
    name: string;
    tnr_status: string;
    coat_color: string;
    pattern_type: string;
  };
}

interface FeedingSpot {
  id: string;
  blurred_location: { latitude: number; longitude: number };
  details: string;
}

export default function MapPage() {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [feedingSpots, setFeedingSpots] = useState<FeedingSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const markersRef = useRef<L.LayerGroup | null>(null);

  const fetchMarkers = useCallback(async (bounds: {
    min_lat: number;
    min_lng: number;
    max_lat: number;
    max_lng: number;
  }) => {
    try {
      const params = new URLSearchParams({
        min_lat: bounds.min_lat.toString(),
        min_lng: bounds.min_lng.toString(),
        max_lat: bounds.max_lat.toString(),
        max_lng: bounds.max_lng.toString(),
      });
      const res = await fetch(`/api/v1/map?${params}`);
      if (!res.ok) throw new Error("Failed to fetch markers");
      const data = await res.json();
      setSightings(data.sightings);
      setFeedingSpots(data.feeding_spots);
    } catch (err) {
      console.error("Failed to load map markers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="h-[calc(100vh-64px)] w-full">
      <MapContainer
        center={[40.7128, -74.006]}
        zoom={14}
        onBoundsChange={fetchMarkers}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/map/page.tsx
git commit -m "feat: add map page with Leaflet"
```

---

### Task 4: Cat List Page

**Files:**
- Create: `frontend/src/app/cats/page.tsx`

- [ ] **Step 1: Create cat list page**

```typescript
// frontend/src/app/cats/page.tsx
"use client";

import { useEffect, useState } from "react";
import { CatCard } from "@/components/CatCard";
import { FilterBar } from "@/components/FilterBar";
import { PixelSpinner } from "@/components/PixelSpinner";
import { EmptyState } from "@/components/EmptyState";

interface Cat {
  id: string;
  name: string;
  tnr_status: string;
  coat_color: string;
  pattern_type: string;
  ear_tip_status: boolean;
  latest_photo: string | null;
}

export default function CatsPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    coatColor: null as string | null,
    patternType: null as string | null,
    tnrStatus: null as string | null,
  });

  useEffect(() => {
    const fetchCats = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: page.toString(), per_page: "12" });
        if (filters.coatColor) params.set("coat_color", filters.coatColor);
        if (filters.patternType) params.set("pattern_type", filters.patternType);
        if (filters.tnrStatus) params.set("tnr_status", filters.tnrStatus);

        const res = await fetch(`/api/v1/cats?${params}`);
        if (!res.ok) throw new Error("Failed to fetch cats");
        const data = await res.json();
        setCats(data.cats);
        setTotal(data.total);
      } catch (err) {
        console.error("Failed to load cats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCats();
  }, [page, filters]);

  const handleFilterChange = (newFilters: { coatColor?: string | null; patternType?: string | null; tnrStatus?: string | null }) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPage(1);
  };

  const totalPages = Math.ceil(total / 12);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Community Cats</h1>

      <FilterBar
        coatColor={filters.coatColor}
        patternType={filters.patternType}
        tnrStatus={filters.tnrStatus}
        onChange={handleFilterChange}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <PixelSpinner label="Loading cats..." />
        </div>
      ) : cats.length === 0 ? (
        <EmptyState
          title="No cats found"
          description="Try adjusting your filters or check back later."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {cats.map((cat) => (
              <CatCard
                key={cat.id}
                id={cat.id}
                name={cat.name}
                tnrStatus={cat.tnr_status}
                coatColor={cat.coat_color}
                patternType={cat.pattern_type}
                latestPhoto={cat.latest_photo}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-4 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border-2 border-neutral-900 bg-neutral-0 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border-2 border-neutral-900 bg-neutral-0 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/cats/page.tsx
git commit -m "feat: add cat list page with filters and pagination"
```

---

### Task 5: Cat Profile Page

**Files:**
- Create: `frontend/src/app/cats/[cat_id]/page.tsx`

- [ ] **Step 1: Create cat profile page**

```typescript
// frontend/src/app/cats/[cat_id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { Card } from "@/components/Card";
import { PixelSpinner } from "@/components/PixelSpinner";
import { EmptyState } from "@/components/EmptyState";

interface CatProfile {
  id: string;
  name: string | null;
  photos: string[];
  tnr_status: string;
  coat_color: string | null;
  pattern_type: string | null;
  notable_markings: string | null;
  ear_tip_status: boolean;
  body_size: string | null;
  status_tags: string[];
  sighting_history: Array<{
    id: string;
    blurred_location: { latitude: number; longitude: number };
    observed_at: string;
    condition_tags: string[];
    photo_url: string;
    notes: string | null;
  }>;
  tnr_records: Array<{
    id: string;
    status_change: string;
    notes: string;
    created_at: string;
  }>;
}

const TNR_STATUS_MAP: Record<string, "verified" | "signed_in" | "pending"> = {
  completed: "verified",
  ear_tipped: "verified",
  needs_tnr: "pending",
  scheduled: "pending",
  in_progress: "pending",
  unassessed: "signed_in",
};

export default function CatProfilePage() {
  const params = useParams();
  const catId = params.cat_id as string;
  const [cat, setCat] = useState<CatProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchCat = async () => {
      try {
        const res = await fetch(`/api/v1/cats/${catId}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch cat");
        const data = await res.json();
        setCat(data);
      } catch (err) {
        console.error("Failed to load cat:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCat();
  }, [catId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <PixelSpinner label="Loading cat profile..." />
      </div>
    );
  }

  if (notFound || !cat) {
    return (
      <div className="container mx-auto px-4 py-8">
        <EmptyState
          title="Cat not found"
          description="This cat profile doesn't exist."
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-1/3">
          {cat.photos[0] ? (
            <img
              src={cat.photos[0]}
              alt={cat.name || "Unknown"}
              className="w-full border-2 border-neutral-900"
            />
          ) : (
            <div className="w-full h-64 bg-neutral-100 border-2 border-neutral-900 flex items-center justify-center">
              <span className="text-neutral-500 text-lg">No photo</span>
            </div>
          )}
        </div>

        <div className="lg:w-2/3">
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-3xl font-bold">{cat.name || "Unknown"}</h1>
            <StatusBadge status={TNR_STATUS_MAP[cat.tnr_status] || "signed_in"} />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {cat.coat_color && (
              <div>
                <span className="text-neutral-600">Coat:</span>{" "}
                <span className="font-bold">{cat.coat_color}</span>
              </div>
            )}
            {cat.pattern_type && (
              <div>
                <span className="text-neutral-600">Pattern:</span>{" "}
                <span className="font-bold">{cat.pattern_type}</span>
              </div>
            )}
            {cat.body_size && (
              <div>
                <span className="text-neutral-600">Size:</span>{" "}
                <span className="font-bold">{cat.body_size}</span>
              </div>
            )}
            <div>
              <span className="text-neutral-600">Ear tip:</span>{" "}
              <span className="font-bold">{cat.ear_tip_status ? "Yes" : "No"}</span>
            </div>
          </div>

          {cat.notable_markings && (
            <p className="mb-4">
              <span className="text-neutral-600">Markings:</span> {cat.notable_markings}
            </p>
          )}

          {cat.status_tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {cat.status_tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 border-2 border-neutral-900 bg-neutral-100 text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {cat.sighting_history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Sighting History</h2>
          <div className="space-y-4">
            {cat.sighting_history.map((sighting) => (
              <Card key={sighting.id} variant="standard">
                <div className="flex gap-4">
                  <img
                    src={sighting.photo_url}
                    alt="Sighting"
                    className="w-24 h-24 object-cover border-2 border-neutral-900"
                  />
                  <div>
                    <p className="text-sm text-neutral-600">
                      {new Date(sighting.observed_at).toLocaleDateString()}
                    </p>
                    {sighting.notes && <p>{sighting.notes}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {sighting.condition_tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-1 py-0.5 border border-neutral-900 text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {cat.tnr_records.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">TNR Records</h2>
          <div className="space-y-4">
            {cat.tnr_records.map((record) => (
              <Card key={record.id} variant="standard">
                <div>
                  <p className="font-bold">{record.status_change}</p>
                  <p className="text-sm text-neutral-600">
                    {new Date(record.created_at).toLocaleDateString()}
                  </p>
                  {record.notes && <p className="mt-2">{record.notes}</p>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/cats/[cat_id]/page.tsx
git commit -m "feat: add cat profile page with sighting history and TNR records"
```

---

### Task 6: Update NavigationBar

**Files:**
- Modify: `frontend/src/components/NavigationBar.tsx`

- [ ] **Step 1: Add MAP and CATS links**

Read the current NavigationBar component. Add "MAP" and "CATS" links that are visible to all users (both authenticated and unauthenticated). The links should follow the same styling pattern as the existing "DASHBOARD" link.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/NavigationBar.tsx
git commit -m "feat: add MAP and CATS links to navigation"
```
