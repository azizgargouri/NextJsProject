'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';

type RouteMapProps = {
  pickupLabel: string;
  destinationLabel: string;
  currentStageIndex: number;
  totalStages: number;
};

// Genuine Greater Tunis Road Waypoints: Route Express de La Marsa (RN9)
// Follows real road network from Les Berges du Lac to Avenue Habib Bourguiba, La Marsa
const RN9_ROUTE_WAYPOINTS: [number, number][] = [
  [36.8368, 10.2390], // 0: Pickup: 12 Rue du Lac, Les Berges du Lac 1
  [36.8395, 10.2440], // 1: Boulevard Principal du Lac
  [36.8440, 10.2530], // 2: Lac 2 Interchange / Tunis Sports City
  [36.8480, 10.2620], // 3: RN9 Entry / Carrefour Expressway
  [36.8530, 10.2740], // 4: RN9 Chotrana / Ain Zaghouan Sud
  [36.8580, 10.2850], // 5: RN9 Ain Zaghouan Nord
  [36.8620, 10.2970], // 6: RN9 L'Aouina / Sidi Daoud Junction
  [36.8660, 10.3080], // 7: RN9 Sidi Daoud / Carrefour Express
  [36.8710, 10.3160], // 8: Marsa Plage junction
  [36.8765, 10.3220], // 9: Roundabout Marsa Ville
  [36.8782, 10.3255], // 10: Delivery: 8 Avenue Habib Bourguiba, La Marsa
];

// Helper to interpolate position along segmented polyline [0.0 - 1.0]
function getPolylinePoint(waypoints: [number, number][], progress: number): [number, number] {
  const clamped = Math.max(0, Math.min(1, progress));
  const totalSegments = waypoints.length - 1;
  const floatIdx = clamped * totalSegments;
  const segIdx = Math.min(Math.floor(floatIdx), totalSegments - 1);
  const segFraction = floatIdx - segIdx;

  const p1 = waypoints[segIdx]!;
  const p2 = waypoints[segIdx + 1]!;

  return [
    p1[0] + (p2[0] - p1[0]) * segFraction,
    p1[1] + (p2[1] - p1[1]) * segFraction,
  ];
}

export function MoveRouteMap({
  pickupLabel,
  destinationLabel,
  currentStageIndex,
  totalStages,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const libRef = useRef<typeof Leaflet | null>(null);

  const [simulatedProgress, setSimulatedProgress] = useState(0.45);
  const [telemetry, setTelemetry] = useState({
    lat: 36.8580,
    lon: 10.2850,
    speed: 48,
    heading: 'NE 42°',
    corridor: 'RN9 Voie Express Tunis-La Marsa',
  });

  // Smooth transit simulation interval when in transit stage
  useEffect(() => {
    // Stage 5 is 'IN_TRANSIT' in standard 8-stage pipeline
    const isInTransit = currentStageIndex === 5;
    const isEnRoute = currentStageIndex === 2;

    if (!isInTransit && !isEnRoute) {
      if (currentStageIndex <= 1) {
        setSimulatedProgress(0.0);
        setTelemetry((t) => ({ ...t, speed: 0, lat: RN9_ROUTE_WAYPOINTS[0]![0], lon: RN9_ROUTE_WAYPOINTS[0]![1], corridor: 'DEPOT / MOVER BASE' }));
      } else if (currentStageIndex >= 3 && currentStageIndex <= 4) {
        setSimulatedProgress(0.0);
        setTelemetry((t) => ({ ...t, speed: 0, lat: RN9_ROUTE_WAYPOINTS[0]![0], lon: RN9_ROUTE_WAYPOINTS[0]![1], corridor: 'PICKUP SITE (LOADING)' }));
      } else if (currentStageIndex >= 6) {
        setSimulatedProgress(1.0);
        const last = RN9_ROUTE_WAYPOINTS[RN9_ROUTE_WAYPOINTS.length - 1]!;
        setTelemetry((t) => ({ ...t, speed: 0, lat: last[0], lon: last[1], corridor: 'DELIVERY DESTINATION' }));
      }
      return;
    }

    const interval = setInterval(() => {
      setSimulatedProgress((prev) => {
        const next = prev >= 0.92 ? 0.25 : prev + 0.015;
        const pt = getPolylinePoint(RN9_ROUTE_WAYPOINTS, next);
        setTelemetry({
          lat: Number(pt[0].toFixed(4)),
          lon: Number(pt[1].toFixed(4)),
          speed: Math.round(44 + Math.random() * 8),
          heading: 'NE 38°',
          corridor: 'RN9 Voie Express Tunis-La Marsa',
        });
        return next;
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [currentStageIndex]);

  // Leaflet map initialization and layer render
  useEffect(() => {
    let cancelled = false;

    async function renderMap() {
      if (!libRef.current) {
        const leafletModule = await import('leaflet');
        libRef.current = ((leafletModule as unknown as { default?: typeof Leaflet }).default ??
          leafletModule) as typeof Leaflet;
      }
      if (cancelled || !containerRef.current || !libRef.current) return;
      const L = libRef.current;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          zoomControl: true,
          scrollWheelZoom: false,
          attributionControl: true,
        });

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

      // Base calculation of vehicle position along road network
      let effectiveProgress = simulatedProgress;
      if (currentStageIndex <= 1) effectiveProgress = 0.0;
      else if (currentStageIndex >= 3 && currentStageIndex <= 4) effectiveProgress = 0.0;
      else if (currentStageIndex >= 6) effectiveProgress = 1.0;
      else if (currentStageIndex === 2) effectiveProgress = 0.15;

      const vehiclePos = getPolylinePoint(RN9_ROUTE_WAYPOINTS, effectiveProgress);

      const pickupPos = RN9_ROUTE_WAYPOINTS[0]!;
      const deliveryPos = RN9_ROUTE_WAYPOINTS[RN9_ROUTE_WAYPOINTS.length - 1]!;

      // 1. Draw full Planned Road Route (dark subdued)
      L.polyline(RN9_ROUTE_WAYPOINTS, {
        color: '#101010',
        weight: 6,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layer);

      // 2. Draw Traveled Road Segment (vibrant hazard orange-red)
      const passedIdx = Math.floor(effectiveProgress * (RN9_ROUTE_WAYPOINTS.length - 1));
      const passedPoints: [number, number][] = RN9_ROUTE_WAYPOINTS.slice(0, passedIdx + 1);
      passedPoints.push(vehiclePos);

      if (passedPoints.length >= 2) {
        L.polyline(passedPoints, {
          color: '#e61919',
          weight: 6,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(layer);
      }

      // 3. Pickup Site Marker
      L.circleMarker(pickupPos, {
        radius: 8,
        color: '#101010',
        weight: 2,
        fillColor: '#f2f1ec',
        fillOpacity: 1,
      })
        .bindTooltip(`01 / ORIGIN · ${pickupLabel}`, {
          permanent: true,
          direction: 'bottom',
          offset: [0, 8],
          className: 'map-label',
        })
        .addTo(layer);

      // 4. Delivery Site Marker
      L.circleMarker(deliveryPos, {
        radius: 8,
        color: '#101010',
        weight: 2,
        fillColor: '#f2f1ec',
        fillOpacity: 1,
      })
        .bindTooltip(`02 / DESTINATION · ${destinationLabel}`, {
          permanent: true,
          direction: 'top',
          offset: [0, -8],
          className: 'map-label',
        })
        .addTo(layer);

      // 5. Live Moving Van Marker (Hazard pulsed ring)
      L.circleMarker(vehiclePos, {
        radius: 12,
        color: '#ffffff',
        weight: 3,
        fillColor: '#e61919',
        fillOpacity: 1,
      })
        .bindTooltip(`LIVE VAN (142 TN 8942) · ${telemetry.speed} KM/H`, {
          permanent: true,
          direction: 'top',
          offset: [0, -12],
          className: 'map-label font-bold text-hazard',
        })
        .addTo(layer);

      // Fit bounds to the route
      map.fitBounds(RN9_ROUTE_WAYPOINTS, { padding: [48, 48], maxZoom: 14 });
      window.setTimeout(() => map.invalidateSize(), 150);
    }

    void renderMap();
    return () => {
      cancelled = true;
    };
  }, [pickupLabel, destinationLabel, currentStageIndex, totalStages, simulatedProgress, telemetry.speed]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
    layerRef.current = null;
  }, []);

  return (
    <div className="relative h-[44dvh] min-h-80 w-full border-b border-ink bg-paper-soft md:h-[calc(100dvh-57px)]">
      {/* Map container */}
      <div ref={containerRef} className="size-full" aria-label="Interactive move tracking map" />

      {/* Floating GPS HUD Telemetry Box */}
      <div className="pointer-events-none absolute left-3 top-3 z-[1000] border-2 border-ink bg-paper/95 p-3 shadow-lg backdrop-blur-sm mono text-[10px] space-y-1">
        <div className="flex items-center gap-1.5 border-b border-ink pb-1 font-bold">
          <span className="size-2 bg-hazard animate-pulse" />
          <span className="text-hazard font-bold">GPS TELEMETRY ACTIVE</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1 text-ink-80">
          <div>LAT: <span className="text-ink font-bold">{telemetry.lat}&deg; N</span></div>
          <div>LON: <span className="text-ink font-bold">{telemetry.lon}&deg; E</span></div>
          <div>SPEED: <span className="text-hazard font-bold">{telemetry.speed} KM/H</span></div>
          <div>HEADING: <span className="text-ink font-bold">{telemetry.heading}</span></div>
        </div>
        <div className="border-t border-ink/30 pt-1 text-[9px] text-ink-60">
          ROUTE: <span className="text-ink font-medium">{telemetry.corridor}</span>
        </div>
      </div>
    </div>
  );
}
