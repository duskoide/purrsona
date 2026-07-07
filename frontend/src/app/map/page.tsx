"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { PixelSpinner } from "@/components/PixelSpinner";
import type { CatMarkerData, FeedingSpotMarkerData } from "@/components/MapContainer";

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
  details: { description?: string; schedule?: string; [key: string]: unknown };
}

interface MapMarkersResponse {
  sightings: Sighting[];
  feeding_spots: FeedingSpot[];
}

// Whole-world bounding box, used only for the initial "where is the activity"
// lookup that drives auto-centering. Followed immediately by a normal
// viewport-scoped fetch once the map settles on the densest area.
const WORLD_BOUNDS = { min_lat: -85, min_lng: -180, max_lat: 85, max_lng: 180 };

// Grid cell size (degrees) used to bucket sightings into a density map.
// ~0.05deg is roughly 5km at the equator — coarse enough to find a
// neighborhood-level cluster without being thrown off by a single outlier.
const DENSITY_CELL_SIZE = 0.05;
const DENSITY_PADDING_CELLS = 3;

function findDensestCluster(
  sightings: Sighting[],
): [[number, number], [number, number]] | null {
  if (sightings.length === 0) return null;

  const counts = new Map<string, { count: number; latCell: number; lngCell: number }>();

  for (const s of sightings) {
    const latCell = Math.floor(s.blurred_location.latitude / DENSITY_CELL_SIZE);
    const lngCell = Math.floor(s.blurred_location.longitude / DENSITY_CELL_SIZE);
    const key = `${latCell}:${lngCell}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { count: 1, latCell, lngCell });
    }
  }

  let densest = { count: 0, latCell: 0, lngCell: 0 };
  for (const bucket of counts.values()) {
    if (bucket.count > densest.count) densest = bucket;
  }

  const south = (densest.latCell - DENSITY_PADDING_CELLS) * DENSITY_CELL_SIZE;
  const north = (densest.latCell + 1 + DENSITY_PADDING_CELLS) * DENSITY_CELL_SIZE;
  const west = (densest.lngCell - DENSITY_PADDING_CELLS) * DENSITY_CELL_SIZE;
  const east = (densest.lngCell + 1 + DENSITY_PADDING_CELLS) * DENSITY_CELL_SIZE;

  return [
    [south, west],
    [north, east],
  ];
}

export default function MapPage() {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [feedingSpots, setFeedingSpots] = useState<FeedingSpot[]>([]);
  const [autoFitBounds, setAutoFitBounds] =
    useState<[[number, number], [number, number]] | null>(null);
  const hasAutoFitRef = useRef(false);

  const fetchMarkers = useCallback(async (bounds: {
    min_lat: number;
    min_lng: number;
    max_lat: number;
    max_lng: number;
  }): Promise<MapMarkersResponse | null> => {
    try {
      const params = new URLSearchParams({
        min_lat: bounds.min_lat.toString(),
        min_lng: bounds.min_lng.toString(),
        max_lat: bounds.max_lat.toString(),
        max_lng: bounds.max_lng.toString(),
      });
      const res = await fetch(`/api/v1/map?${params}`);
      if (!res.ok) throw new Error("Failed to fetch markers");
      const data: MapMarkersResponse = await res.json();
      setSightings(data.sightings);
      setFeedingSpots(data.feeding_spots);
      return data;
    } catch (err) {
      console.error("Failed to load map markers:", err);
      return null;
    }
  }, []);

  // On first load, look at cat activity across the whole map to find the
  // most populated area and zoom/center there automatically, instead of
  // always opening on a fixed hardcoded location.
  useEffect(() => {
    if (hasAutoFitRef.current) return;
    hasAutoFitRef.current = true;

    (async () => {
      const data = await fetchMarkers(WORLD_BOUNDS);
      if (!data) return;
      const bounds = findDensestCluster(data.sightings);
      if (bounds) setAutoFitBounds(bounds);
    })();
  }, [fetchMarkers]);

  const catMarkers: CatMarkerData[] = sightings.map((s) => ({
    id: s.cat.id,
    latitude: s.blurred_location.latitude,
    longitude: s.blurred_location.longitude,
    name: s.cat.name,
    tnrStatus: s.cat.tnr_status,
    coatColor: s.cat.coat_color,
    patternType: s.cat.pattern_type,
    observedAt: s.observed_at,
  }));

  const feedingMarkers: FeedingSpotMarkerData[] = feedingSpots.map((f) => ({
    id: f.id,
    latitude: f.blurred_location.latitude,
    longitude: f.blurred_location.longitude,
    description: f.details?.description,
    schedule: f.details?.schedule,
  }));

  return (
    <div className="h-[calc(100vh-64px)] w-full">
      <MapContainer
        center={[40.7128, -74.006]}
        zoom={14}
        onBoundsChange={fetchMarkers}
        cats={catMarkers}
        feedingSpots={feedingMarkers}
        autoFitBounds={autoFitBounds}
        showLegend
      />
    </div>
  );
}
