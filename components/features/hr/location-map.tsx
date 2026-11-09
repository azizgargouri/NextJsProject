'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';

export type MapPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

/**
 * Team-location map (ported from the local HR module). Tiles stay light-grey
 * to sit on the paper substrate; markers are ink, hazard when a single
 * employee is focused.
 */
export default function LocationMap({
  points,
  height = '22rem',
}: {
  points: MapPoint[];
  height?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const libRef = useRef<typeof Leaflet | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (!libRef.current) {
        const mod = await import('leaflet');
        libRef.current = ((mod as unknown as { default?: typeof Leaflet }).default ??
          mod) as typeof Leaflet;
      }

      if (cancelled || !containerRef.current || !libRef.current) return;
      const L = libRef.current;

      if (!mapRef.current) {
        const map = L.map(containerRef.current, {
          zoomControl: true,
          scrollWheelZoom: false,
        }).setView([20, 0], 2);

        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom: 19,
            maxNativeZoom: 16,
            attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, OpenStreetMap contributors',
          },
        ).addTo(map);

        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 19, maxNativeZoom: 16 },
        ).addTo(map);

        mapRef.current = map;
        layerRef.current = L.layerGroup().addTo(map);
      }

      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map || !layer) return;

      layer.clearLayers();

      if (points.length === 0) {
        map.setView([20, 0], 2);
        return;
      }

      const focused = points.length === 1;
      for (const point of points) {
        L.circleMarker([point.lat, point.lng], {
          radius: 9,
          color: '#f2f1ec',
          weight: 2,
          fillColor: focused ? '#e61919' : '#101010',
          fillOpacity: 1,
        })
          .bindTooltip(point.name, {
            permanent: true,
            direction: 'top',
            offset: [0, -9],
            className: 'map-label',
          })
          .addTo(layer);
      }

      const first = points[0];
      if (focused && first) {
        map.setView([first.lat, first.lng], 15);
      } else {
        map.fitBounds(
          points.map((point) => [point.lat, point.lng] as [number, number]),
          { padding: [48, 48], maxZoom: 15 },
        );
      }

      window.setTimeout(() => map.invalidateSize(), 120);
    }

    sync();

    return () => {
      cancelled = true;
    };
  }, [points]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="z-0 w-full overflow-hidden border border-ink bg-paper-soft"
    />
  );
}
