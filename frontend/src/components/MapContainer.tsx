"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface CatMarkerData {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  tnrStatus: string;
  coatColor: string;
  patternType: string;
  observedAt?: string;
}

export interface FeedingSpotMarkerData {
  id: string;
  latitude: number;
  longitude: number;
  description?: string;
  schedule?: string;
}

const TNR_STATUS_LABELS: Record<string, string> = {
  unassessed: "Unassessed",
  needs_tnr: "Needs TNR",
  scheduled: "TNR Scheduled",
  in_progress: "TNR In Progress",
  completed: "TNR Completed",
  ear_tipped: "Ear Tipped",
};

// Same semantic palette as StatusBadge — keeps map markers consistent
// with the rest of the app's TNR status color coding.
const TNR_STATUS_COLORS: Record<string, string> = {
  unassessed: "#9a8874", // neutral-500
  needs_tnr: "#D97706", // warning-main
  scheduled: "#D97706", // warning-main
  in_progress: "#D97706", // warning-main
  completed: "#16A34A", // success-main
  ear_tipped: "#16A34A", // success-main
};

function catDivIcon(tnrStatus: string): L.DivIcon {
  const color = TNR_STATUS_COLORS[tnrStatus] || "#9a8874";
  return L.divIcon({
    className: "purrsona-marker",
    html: `
      <div class="purrsona-marker-cat" style="background:${color}">
        <span aria-hidden="true">\u{1F408}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 30],
    popupAnchor: [0, -28],
  });
}

const feedingDivIcon = L.divIcon({
  className: "purrsona-marker",
  html: `
    <div class="purrsona-marker-feeding">
      <span aria-hidden="true">\u{1F963}</span>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 28],
  popupAnchor: [0, -26],
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function catPopupHtml(cat: CatMarkerData): string {
  const statusLabel = TNR_STATUS_LABELS[cat.tnrStatus] || cat.tnrStatus;
  const observed = cat.observedAt
    ? new Date(cat.observedAt).toLocaleDateString()
    : null;
  return `
    <div class="purrsona-popup">
      <p class="purrsona-popup-title">${escapeHtml(cat.name || "Unknown cat")}</p>
      <p class="purrsona-popup-line"><strong>TNR status:</strong> ${escapeHtml(statusLabel)}</p>
      <p class="purrsona-popup-line">${escapeHtml(cat.coatColor)} &middot; ${escapeHtml(cat.patternType)}</p>
      ${observed ? `<p class="purrsona-popup-line">Last seen: ${escapeHtml(observed)}</p>` : ""}
      <a class="purrsona-popup-link" href="/cats/${cat.id}">View cat profile</a>
    </div>
  `;
}

function feedingPopupHtml(spot: FeedingSpotMarkerData): string {
  return `
    <div class="purrsona-popup">
      <p class="purrsona-popup-title">Feeding spot</p>
      ${spot.description ? `<p class="purrsona-popup-line">${escapeHtml(spot.description)}</p>` : ""}
      ${spot.schedule ? `<p class="purrsona-popup-line"><strong>Schedule:</strong> ${escapeHtml(spot.schedule)}</p>` : ""}
    </div>
  `;
}

interface MapLegendControlOptions extends L.ControlOptions {
  position?: L.ControlPosition;
}

class LegendControl extends L.Control {
  constructor(options?: MapLegendControlOptions) {
    super({ position: "bottomleft", ...options });
  }

  onAdd(): HTMLElement {
    const container = L.DomUtil.create("div", "purrsona-legend");
    container.innerHTML = `
      <p class="purrsona-legend-title">MAP KEY</p>
      <div class="purrsona-legend-row">
        <span class="purrsona-legend-swatch" style="background:${TNR_STATUS_COLORS.completed}">\u{1F408}</span>
        <span>Cat — TNR done</span>
      </div>
      <div class="purrsona-legend-row">
        <span class="purrsona-legend-swatch" style="background:${TNR_STATUS_COLORS.needs_tnr}">\u{1F408}</span>
        <span>Cat — TNR needed/in progress</span>
      </div>
      <div class="purrsona-legend-row">
        <span class="purrsona-legend-swatch" style="background:${TNR_STATUS_COLORS.unassessed}">\u{1F408}</span>
        <span>Cat — unassessed</span>
      </div>
      <div class="purrsona-legend-row">
        <span class="purrsona-legend-swatch purrsona-legend-swatch-feeding">\u{1F963}</span>
        <span>Feeding spot</span>
      </div>
    `;
    L.DomEvent.disableClickPropagation(container);
    return container;
  }
}

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
  cats?: CatMarkerData[];
  feedingSpots?: FeedingSpotMarkerData[];
  showLegend?: boolean;
  /**
   * One-time programmatic re-center/zoom (e.g. once the densest cluster of
   * cat activity is known). Applying the same bounds object again is a
   * no-op — pass a new object reference to trigger another fit.
   */
  autoFitBounds?: [[number, number], [number, number]] | null;
  children?: React.ReactNode;
}

export function MapContainer({
  center,
  zoom,
  onClick,
  onBoundsChange,
  cats,
  feedingSpots,
  showLegend = false,
  autoFitBounds,
}: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const onClickRef = useRef(onClick);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const appliedFitBoundsRef = useRef<typeof autoFitBounds>(null);

  useEffect(() => { onClickRef.current = onClick; }, [onClick]);
  useEffect(() => { onBoundsChangeRef.current = onBoundsChange; }, [onBoundsChange]);

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const map = L.map(mapRef.current).setView(center, zoom);
    leafletMapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);

    if (showLegend) {
      new LegendControl().addTo(map);
    }

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
      markersLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render markers whenever the cat/feeding-spot data changes, without
  // recreating the map itself.
  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer) return;

    layer.clearLayers();

    (cats || []).forEach((cat) => {
      L.marker([cat.latitude, cat.longitude], {
        icon: catDivIcon(cat.tnrStatus),
        alt: `${cat.name || "Unknown cat"} — ${TNR_STATUS_LABELS[cat.tnrStatus] || cat.tnrStatus}`,
        keyboard: true,
      })
        .bindPopup(catPopupHtml(cat))
        .addTo(layer);
    });

    (feedingSpots || []).forEach((spot) => {
      L.marker([spot.latitude, spot.longitude], {
        icon: feedingDivIcon,
        alt: "Feeding spot",
        keyboard: true,
      })
        .bindPopup(feedingPopupHtml(spot))
        .addTo(layer);
    });
  }, [cats, feedingSpots]);

  // Apply a one-time auto-fit (e.g. to the densest cluster of cat activity)
  // once it becomes available. Guarded so repeated renders with the same
  // bounds don't keep resetting the user's manual pan/zoom.
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !autoFitBounds) return;
    if (appliedFitBoundsRef.current === autoFitBounds) return;

    appliedFitBoundsRef.current = autoFitBounds;
    map.fitBounds(autoFitBounds, { maxZoom: 16, padding: [40, 40] });
  }, [autoFitBounds]);

  return <div ref={mapRef} className="h-full w-full" />;
}
