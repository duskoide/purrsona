"use client";

import { useCallback, useState } from "react";
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
