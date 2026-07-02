"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapContainerProps {
  center: [number, number];
  zoom: number;
  onClick?: (lat: number, lng: number) => void;
  onBoundsChange?: (bounds: {
    min_lat: number;
    min_lng: number;
    max_lat: number;
    max_lng: number;
  }) => void;
  children?: React.ReactNode;
}

export function MapContainer({ center, zoom, onClick, onBoundsChange }: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const onClickRef = useRef(onClick);
  const onBoundsChangeRef = useRef(onBoundsChange);

  useEffect(() => { onClickRef.current = onClick; }, [onClick]);
  useEffect(() => { onBoundsChangeRef.current = onBoundsChange; }, [onBoundsChange]);

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const map = L.map(mapRef.current).setView(center, zoom);
    leafletMapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onClickRef.current?.(e.latlng.lat, e.latlng.lng);
    });

    const updateBounds = () => {
      onBoundsChangeRef.current?.({
        min_lat: map.getBounds().getSouth(),
        min_lng: map.getBounds().getWest(),
        max_lat: map.getBounds().getNorth(),
        max_lng: map.getBounds().getEast(),
      });
    };

    map.on("moveend", updateBounds);
    updateBounds();

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  return <div ref={mapRef} className="h-full w-full" />;
}
