'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';

type RouteMapProps = {
  pickupLabel: string;
  destinationLabel: string;
  currentStageIndex: number;
  totalStages: number;
};

// Demo coordinates are centred on Greater Tunis until address autocomplete and
// geocoding are connected. Labels always come from the actual move record.
const PICKUP: [number, number] = [36.8381, 10.2395];
const DESTINATION: [number, number] = [36.8702, 10.3292];

export function MoveRouteMap({ pickupLabel, destinationLabel, currentStageIndex, totalStages }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const libRef = useRef<typeof Leaflet | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function renderMap() {
      if (!libRef.current) {
        const leafletModule = await import('leaflet');
        libRef.current = ((leafletModule as unknown as { default?: typeof Leaflet }).default ?? leafletModule) as typeof Leaflet;
      }
      if (cancelled || !containerRef.current || !libRef.current) return;
      const L = libRef.current;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
        // The route and markers work without this tile layer. When connected,
        // OpenStreetMap supplies the real street background.
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }

      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map || !layer) return;
      layer.clearLayers();

      const progress = Math.min(1, Math.max(0.1, currentStageIndex / Math.max(totalStages - 1, 1)));
      const vehicle: [number, number] = [
        PICKUP[0] + (DESTINATION[0] - PICKUP[0]) * progress,
        PICKUP[1] + (DESTINATION[1] - PICKUP[1]) * progress,
      ];
      const route: [number, number][] = [PICKUP, vehicle, DESTINATION];

      L.polyline(route, { color: '#101010', weight: 4, opacity: 0.32 }).addTo(layer);
      L.polyline([PICKUP, vehicle], { color: '#e61919', weight: 5, opacity: 1 }).addTo(layer);

      const marker = (position: [number, number], color: string, label: string) =>
        L.circleMarker(position, { radius: 10, color: '#101010', weight: 2, fillColor: color, fillOpacity: 1 })
          .bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -10], className: 'map-label' })
          .addTo(layer);

      marker(PICKUP, '#f2f1ec', `PICKUP · ${pickupLabel}`);
      marker(DESTINATION, '#f2f1ec', `DELIVERY · ${destinationLabel}`);
      marker(vehicle, '#e61919', 'VEHICLE · LIVE POSITION');
      map.fitBounds(route, { padding: [42, 42], maxZoom: 14 });
      window.setTimeout(() => map.invalidateSize(), 100);
    }
    void renderMap();
    return () => { cancelled = true; };
  }, [pickupLabel, destinationLabel, currentStageIndex, totalStages]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
    layerRef.current = null;
  }, []);

  return <div ref={containerRef} className="h-[42dvh] min-h-80 w-full border-b border-ink bg-paper-soft md:h-[calc(100dvh-57px)]" aria-label="Interactive move tracking map" />;
}
