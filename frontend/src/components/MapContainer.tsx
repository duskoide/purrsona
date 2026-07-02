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

export function MapContainer({ center, zoom, onBoundsChange }: MapContainerProps) {
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
