'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';
import { MapPin, Compass, Check, LocateFixed } from 'lucide-react';

interface RouteMapPickerProps {
  onLocationSelect: (data: {
    pickupAddress: string;
    pickupCoords: [number, number];
    destinationAddress: string;
    destinationCoords: [number, number];
    distanceKm: number;
  }) => void;
  initialDistance?: number;
}

// Preset popular destinations in Greater Tunis for 1-tap selection
const POPULAR_DESTINATIONS = [
  { name: 'La Marsa (Plage / Ville)', coords: [36.8782, 10.3255] as [number, number], label: 'Avenue Habib Bourguiba, La Marsa' },
  { name: 'Les Berges du Lac 2', coords: [36.8440, 10.2530] as [number, number], label: 'Boulevard de la Terre, Lac 2' },
  { name: 'Carthage Byrsa', coords: [36.8528, 10.3233] as [number, number], label: 'Colline de Byrsa, Carthage' },
  { name: 'Sidi Bou Said', coords: [36.8698, 10.3414] as [number, number], label: 'Village de Sidi Bou Said' },
  { name: 'Ennasr 2', coords: [36.8550, 10.1580] as [number, number], label: 'Avenue Hédi Nouira, Ennasr 2' },
  { name: 'Tunis Centre Ville', coords: [36.8008, 10.1800] as [number, number], label: 'Avenue Habib Bourguiba, Tunis' },
  { name: 'Ariana / El Ghazela', coords: [36.8920, 10.1850] as [number, number], label: 'Pôle Technologique El Ghazela, Ariana' },
];

// Default fallback coordinates (Les Berges du Lac 1)
const DEFAULT_PICKUP: [number, number] = [36.8368, 10.2390];
const DEFAULT_DESTINATION: [number, number] = [36.8782, 10.3255];

// Calculate approximate road driving distance via Haversine + road winding factor (1.35x)
function calculateDrivingDistance(coord1: [number, number], coord2: [number, number]): number {
  const R = 6371; // Earth radius in km
  const dLat = ((coord2[0] - coord1[0]) * Math.PI) / 180;
  const dLon = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1[0] * Math.PI) / 180) *
      Math.cos((coord2[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLineKm = R * c;
  // Road coefficient: real routes are ~1.35x straight line
  return Math.max(2, Math.round(straightLineKm * 1.35));
}

export function RouteMapPicker({ onLocationSelect }: RouteMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const libRef = useRef<typeof Leaflet | null>(null);

  const [pickup, setPickup] = useState<[number, number]>(DEFAULT_PICKUP);
  const [destination, setDestination] = useState<[number, number]>(DEFAULT_DESTINATION);
  const [pickupLabel, setPickupLabel] = useState('My Position (Les Berges du Lac)');
  const [destinationLabel, setDestinationLabel] = useState('8 Avenue Habib Bourguiba, La Marsa');
  const [distanceKm, setDistanceKm] = useState(12);
  const [isLocating, setIsLocating] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('La Marsa (Plage / Ville)');

  // Geolocation: Auto-detect or click to use current GPS position
  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const myCoords: [number, number] = [
          Number(pos.coords.latitude.toFixed(4)),
          Number(pos.coords.longitude.toFixed(4)),
        ];
        setPickup(myCoords);
        const label = `My GPS Position (${myCoords[0]}° N, ${myCoords[1]}° E)`;
        setPickupLabel(label);

        const newDist = calculateDrivingDistance(myCoords, destination);
        setDistanceKm(newDist);

        onLocationSelect({
          pickupAddress: label,
          pickupCoords: myCoords,
          destinationAddress: destinationLabel,
          destinationCoords: destination,
          distanceKm: newDist,
        });

        // Pan map
        if (mapRef.current) {
          mapRef.current.setView(myCoords, 13);
        }
      },
      () => {
        setIsLocating(false);
        // Fallback to default
        setPickupLabel('My Position (Les Berges du Lac)');
      },
      { timeout: 8000, enableHighAccuracy: true },
    );
  }, [destination, destinationLabel, onLocationSelect]);

  // Handle Preset Destination Click
  const handleSelectPreset = (preset: typeof POPULAR_DESTINATIONS[0]) => {
    setActivePreset(preset.name);
    setDestination(preset.coords);
    setDestinationLabel(preset.label);

    const dist = calculateDrivingDistance(pickup, preset.coords);
    setDistanceKm(dist);

    onLocationSelect({
      pickupAddress: pickupLabel,
      pickupCoords: pickup,
      destinationAddress: preset.label,
      destinationCoords: preset.coords,
      distanceKm: dist,
    });
  };

  // Render map & update pins
  useEffect(() => {
    let cancelled = false;

    async function initMap() {
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
          scrollWheelZoom: true,
          attributionControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(mapRef.current);

        layerRef.current = L.layerGroup().addTo(mapRef.current);

        // Click on map to set Destination Pin
        mapRef.current.on('click', (e: Leaflet.LeafletMouseEvent) => {
          const clickedCoords: [number, number] = [
            Number(e.latlng.lat.toFixed(4)),
            Number(e.latlng.lng.toFixed(4)),
          ];
          setDestination(clickedCoords);
          setActivePreset('');
          const label = `Selected on Map (${clickedCoords[0]}° N, ${clickedCoords[1]}° E)`;
          setDestinationLabel(label);

          const dist = calculateDrivingDistance(pickup, clickedCoords);
          setDistanceKm(dist);

          onLocationSelect({
            pickupAddress: pickupLabel,
            pickupCoords: pickup,
            destinationAddress: label,
            destinationCoords: clickedCoords,
            distanceKm: dist,
          });
        });
      }

      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map || !layer) return;
      layer.clearLayers();

      // 1. Draw route line between Pickup and Destination
      const routeLine: [number, number][] = [pickup, destination];
      L.polyline(routeLine, {
        color: '#e61919',
        weight: 5,
        opacity: 0.85,
        dashArray: '8, 8',
      }).addTo(layer);

      // 2. Pickup Pin (Your Position)
      L.circleMarker(pickup, {
        radius: 10,
        color: '#101010',
        weight: 3,
        fillColor: '#101010',
        fillOpacity: 1,
      })
        .bindTooltip(`📍 01: ORIGIN (MY POSITION)\n${pickupLabel}`, {
          permanent: true,
          direction: 'bottom',
          offset: [0, 8],
          className: 'map-label font-bold',
        })
        .addTo(layer);

      // 3. Destination Pin (Click to move)
      L.circleMarker(destination, {
        radius: 12,
        color: '#ffffff',
        weight: 3,
        fillColor: '#e61919',
        fillOpacity: 1,
      })
        .bindTooltip(`🎯 02: DESTINATION (${distanceKm} KM)\n${destinationLabel}`, {
          permanent: true,
          direction: 'top',
          offset: [0, -10],
          className: 'map-label font-bold text-hazard',
        })
        .addTo(layer);

      map.fitBounds([pickup, destination], { padding: [48, 48], maxZoom: 14 });
      window.setTimeout(() => map.invalidateSize(), 150);
    }

    void initMap();
    return () => {
      cancelled = true;
    };
  }, [pickup, destination, pickupLabel, destinationLabel, distanceKm, onLocationSelect]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
    layerRef.current = null;
  }, []);

  return (
    <div className="border-2 border-ink bg-paper p-4 md:p-6 space-y-4">
      {/* Header and 1-Click My Position button */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-3">
        <div>
          <span className="mono text-[10px] text-hazard font-bold flex items-center gap-1.5">
            <Compass size={13} /> INTERACTIVE ROUTE &amp; DESTINATION PICKER
          </span>
          <h3 className="display text-xl md:text-2xl font-bold mt-0.5">
            TAP MAP OR PICK DESTINATION.
          </h3>
        </div>

        <button
          type="button"
          onClick={locateMe}
          disabled={isLocating}
          className="mono flex items-center gap-2 border-2 border-ink bg-ink text-paper px-3.5 py-2 text-xs font-bold hover:bg-hazard hover:border-hazard transition"
        >
          <LocateFixed size={14} className={isLocating ? 'animate-spin text-hazard' : 'text-hazard'} />
          <span>{isLocating ? 'LOCATING GPS…' : 'USE MY CURRENT POSITION'}</span>
        </button>
      </div>

      {/* Preset 1-Tap Destinations Bar */}
      <div>
        <p className="mono text-[10px] text-ink-60 font-bold uppercase mb-2">
          OR 1-TAP POPULAR DESTINATIONS:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_DESTINATIONS.map((preset) => {
            const isSelected = activePreset === preset.name;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`mono text-[11px] px-3 py-1.5 border font-semibold transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'border-hazard bg-hazard text-white font-bold'
                    : 'border-ink bg-paper-soft hover:bg-ink hover:text-paper'
                }`}
              >
                {isSelected && <Check size={12} strokeWidth={3} />}
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Map Box */}
      <div className="relative overflow-hidden border-2 border-ink bg-paper-soft">
        <div ref={containerRef} className="h-64 sm:h-80 w-full" aria-label="Route map picker" />

        {/* Map Helper overlay banner */}
        <div className="pointer-events-none absolute bottom-3 inset-x-3 z-[1000] flex items-center justify-between border border-ink bg-paper/95 p-2.5 backdrop-blur-sm mono text-[10px] shadow-md">
          <div className="flex items-center gap-1.5 text-ink">
            <MapPin size={13} className="text-hazard shrink-0" />
            <span>TAP ANYWHERE ON MAP TO SET DELIVERY PIN</span>
          </div>
          <div className="font-bold text-hazard">
            AUTO-CALCULATED: {distanceKm} KM
          </div>
        </div>
      </div>

      {/* Auto-selected location readouts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mono text-xs pt-1">
        <div className="border border-ink p-2.5 bg-paper-soft">
          <p className="text-[9px] text-ink-40 font-bold uppercase">01 / PICKUP (YOUR POSITION)</p>
          <p className="font-bold text-ink mt-0.5 truncate">{pickupLabel}</p>
        </div>

        <div className="border border-hazard p-2.5 bg-hazard/5">
          <p className="text-[9px] text-hazard font-bold uppercase">02 / DESTINATION (CLICKED PIN)</p>
          <p className="font-bold text-ink mt-0.5 truncate">{destinationLabel}</p>
        </div>
      </div>
    </div>
  );
}
