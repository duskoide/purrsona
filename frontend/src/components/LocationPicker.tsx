"use client";

import dynamic from "next/dynamic";
import { PixelSpinner } from "./PixelSpinner";

const MapContainer = dynamic(
  () => import("./MapContainer").then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <PixelSpinner label="Loading map..." /> }
);

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  selectedLocation: [number, number] | null;
}

export function LocationPicker({ onLocationSelect, selectedLocation }: LocationPickerProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-80 w-full border-2 border-neutral-900">
        <MapContainer
          center={selectedLocation || [40.7128, -74.006]}
          zoom={14}
          onClick={onLocationSelect}
        />
      </div>
      {selectedLocation && (
        <p className="text-sm text-neutral-600">
          Location: {selectedLocation[0].toFixed(4)}, {selectedLocation[1].toFixed(4)}
        </p>
      )}
    </div>
  );
}
