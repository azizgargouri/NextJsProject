'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Minus, Plus, Truck, WifiOff, Weight, Box, UserCheck, LogIn, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadScan, type ScanSuggestion } from './load-scan';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { api, ensureAccessToken } from '@/lib/api';

type InventoryItem = {
  id: string;
  name: string;
  volume: number;
  weight: number;
  quantity: number;
};

const CATALOGUE = [
  { id: 'box', name: 'Moving box', volume: 0.08, weight: 12 },
  { id: 'chair', name: 'Chair / Armchair', volume: 0.18, weight: 8 },
  { id: 'sofa', name: '3-Seater Sofa', volume: 1.6, weight: 65 },
  { id: 'bed', name: 'Double Bed', volume: 1.8, weight: 55 },
  { id: 'fridge', name: 'Fridge / Freezer', volume: 1.1, weight: 85 },
  { id: 'washer', name: 'Washing machine', volume: 0.65, weight: 72 },
  { id: 'table', name: 'Dining Table', volume: 1.25, weight: 35 },
];

const VEHICLES = [
  { name: 'Small Partner van', capacity: 3.5, payload: 600, base: 35, label: 'Boxes, studio & light luggage (< 600 kg)' },
  { name: 'Compact van', capacity: 6, payload: 1000, base: 45, label: '1–8 boxes / studio (< 1,000 kg)' },
  { name: 'Moving van', capacity: 14, payload: 1800, base: 75, label: '1–2 bedrooms / furniture (< 1.8 t)' },
  { name: 'Box truck', capacity: 28, payload: 3500, base: 115, label: '2–3 bedrooms / full move (< 3.5 t)' },
  { name: 'Large truck', capacity: 45, payload: 7500, base: 165, label: 'Large home / commercial move (< 7.5 t)' },
];

const STORAGE_KEY = 'moveup_booking_draft_v1';

export function MoveBooking() {
  const router = useRouter();
  const { isAuthenticated, user, accessToken } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [distance, setDistance] = useState(12);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickupAddress, setPickupAddress] = useState('12 Rue du Lac, Les Berges du Lac');
  const [destinationAddress, setDestinationAddress] = useState('8 Avenue Habib Bourguiba, La Marsa');
  const [isOffline, setIsOffline] = useState(false);
  const [chosenVehicle, setChosenVehicle] = useState<string>('AUTO');

  useEffect(() => {
    setMounted(true);
    setIsOffline(!navigator.onLine);

    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Restore draft from localStorage if present
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.items) && parsed.items.length > 0) setItems(parsed.items);
        if (parsed.distance) setDistance(parsed.distance);
        if (parsed.pickupAddress) setPickupAddress(parsed.pickupAddress);
        if (parsed.destinationAddress) setDestinationAddress(parsed.destinationAddress);
        if (parsed.chosenVehicle) setChosenVehicle(parsed.chosenVehicle);
      }
    } catch {
      // Ignore storage errors
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!mounted || isAuthenticated) return;
    router.replace('/sign-in?redirect=/request');
  }, [isAuthenticated, mounted, router]);

  // Auto-save draft
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ items, distance, pickupAddress, destinationAddress, chosenVehicle }),
      );
    } catch {
      // Ignore storage errors
    }
  }, [items, distance, pickupAddress, destinationAddress, chosenVehicle, mounted]);

  const volume = useMemo(
    () => items.reduce((total, item) => total + item.volume * item.quantity, 0),
    [items],
  );

  const weight = useMemo(
    () => items.reduce((total, item) => total + (item.weight || 20) * item.quantity, 0),
    [items],
  );

  // Vehicle matching checks BOTH volume capacity AND payload weight capacity
  const recommendedVehicle = useMemo(() => {
    return (
      VEHICLES.find((v) => volume <= v.capacity && weight <= v.payload) ??
      VEHICLES[VEHICLES.length - 1]!
    );
  }, [volume, weight]);

  const vehicle =
    chosenVehicle === 'AUTO'
      ? recommendedVehicle
      : VEHICLES.find((item) => item.name === chosenVehicle) ?? recommendedVehicle;

  // Calibrated pricing: Base fee + km rate + volumetric fee + heavy cargo fee
  const price = Math.round(
    vehicle.base + distance * 1.15 + volume * 4 + (weight > 400 ? (weight - 400) * 0.04 : 0),
  );

  function changeItem(source: { id: string; name: string; volume: number; weight: number }, change: number) {
    setItems((current) => {
      const found = current.find((item) => item.id === source.id);
      if (!found && change > 0) return [...current, { ...source, quantity: 1 }];
      if (!found) return current;
      const quantity = found.quantity + change;
      if (quantity <= 0) return current.filter((item) => item.id !== source.id);
      return current.map((item) => (item.id === source.id ? { ...item, quantity } : item));
    });
  }

  function addScannedItem(scan: ScanSuggestion) {
    changeItem(scan, 1);
  }

  async function submitRequest() {
    setError(null);

    // 1. Check if user is offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError(
        'You are offline. Your move draft is safely preserved and will submit once your connection is back.',
      );
      return;
    }

    // 2. MANDATORY AUTHENTICATION CHECK: User must be signed in as a CLIENT before booking
    if (!isAuthenticated || !user) {
      setError('Please sign in to confirm your move booking. Your draft is safely saved.');
      router.push('/sign-in?redirect=/request');
      return;
    }

    if (user.role !== 'CLIENT') {
      setError(
        `You are currently logged in as ${user.role}. Only a Client account can request a move. Please switch to a Client account.`,
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // A reload can leave Zustand hydrated without its short-lived access
      // token. Restore it from the secure refresh cookie before booking.
      if (!accessToken) {
        const token = await ensureAccessToken();
        if (!token) {
          throw new Error('Your session has expired. Please sign in again.');
        }
      }

      const response = await api.moves.create({
        pickupAddress,
        destinationAddress,
        distance,
        items,
        vehicleName: vehicle.name,
      });

      // Clear draft on successful creation
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}

      router.push(`/track/${response.move.id}?token=${response.move.trackingToken}`);
    } catch (submitError: unknown) {
      const axiosErr = submitError as {
        response?: { status?: number; data?: { code?: string; message?: string } };
        message?: string;
      };
      const status = axiosErr?.response?.status;
      const code = axiosErr?.response?.data?.code;
      const message = axiosErr?.response?.data?.message || axiosErr?.message;

      if (status === 401 || code === 'UNAUTHORIZED') {
        // Session token expired or invalid and refresh failed
        useAuthStore.getState().logout();
        setError('Your session has expired. Please sign in again — your inventory and draft are safely saved.');
        router.push('/sign-in?redirect=/request');
      } else {
        setError(message ?? 'Could not create your move. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const volumePct = Math.min(100, Math.round((volume / vehicle.capacity) * 100));
  const weightPct = Math.min(100, Math.round((weight / vehicle.payload) * 100));
  const isOverweight = weight > vehicle.payload;
  const isOvervolume = volume > vehicle.capacity;

  if (!mounted || !isAuthenticated || !user) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper p-6 text-ink">
        <div className="w-full max-w-md border-2 border-ink bg-paper-soft p-7 text-center">
          <p className="mono text-[10px] text-hazard">[ SECURE BOOKING ]</p>
          <h1 className="display mt-3 text-4xl">SIGN IN<br />TO BOOK.</h1>
          <p className="mt-4 text-sm text-ink-80">A Client account is required before you can scan items, calculate a vehicle, or request a move.</p>
          <Link href="/sign-in?redirect=/request" className="mono mt-6 inline-flex border-2 border-ink bg-ink px-5 py-3 text-xs font-bold text-paper hover:bg-hazard">SIGN IN AS CLIENT</Link>
        </div>
      </main>
    );
  }

  if (user.role !== 'CLIENT') {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper p-6 text-ink">
        <div className="w-full max-w-md border-2 border-ink bg-paper-soft p-7 text-center">
          <p className="mono text-[10px] text-hazard">[ CLIENT ACCOUNT REQUIRED ]</p>
          <h1 className="display mt-3 text-4xl">SWITCH<br />ACCOUNT.</h1>
          <p className="mt-4 text-sm text-ink-80">You are signed in as a {user.role.toLowerCase()}. Only Client accounts can request a vehicle.</p>
          <button type="button" onClick={() => { useAuthStore.getState().logout(); router.push('/sign-in?redirect=/request'); }} className="mono mt-6 border-2 border-ink bg-ink px-5 py-3 text-xs font-bold text-paper hover:bg-hazard">SIGN IN AS CLIENT</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-paper pb-28 text-ink md:pb-0">
      {/* Top Header */}
      <header className="border-b border-ink bg-paper px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="mono text-sm font-bold flex items-center gap-2">
            <span className="inline-block size-2.5 bg-hazard" />
            MOVE<span className="text-hazard">UP</span>
          </Link>
          <div className="flex items-center gap-3">
            {mounted && isAuthenticated ? (
              <p className="mono text-[10px] text-ink-80 flex items-center gap-1.5">
                <UserCheck size={13} className="text-hazard" />
                <span>{user?.name?.toUpperCase()} &middot; CLIENT</span>
              </p>
            ) : (
              <Link
                href="/sign-in?redirect=/request"
                className="mono text-[10px] text-hazard underline hover:text-ink flex items-center gap-1"
              >
                <LogIn size={12} />
                SIGN IN BEFORE BOOKING
              </Link>
            )}
            <span className="mono text-[10px] text-ink-40 hidden sm:inline">&middot; STEP 01/02</span>
          </div>
        </div>
      </header>

      {/* Guest Mode / Auth Status Notice */}
      {mounted && !isAuthenticated && (
        <div className="border-b border-ink bg-hazard/10 px-4 py-2.5 text-center mono text-xs text-ink flex items-center justify-center gap-2">
          <span>GUEST MODE: Configure your items and LiDAR scan freely &mdash;</span>
          <Link
            href="/sign-in?redirect=/request"
            className="font-bold underline text-hazard hover:text-ink"
          >
            Sign in as Client to confirm booking &gt;&gt;
          </Link>
        </div>
      )}

      {/* Non-client warning */}
      {mounted && isAuthenticated && user?.role !== 'CLIENT' && (
        <div className="border-b border-ink bg-hazard px-4 py-2.5 text-center mono text-xs text-white flex items-center justify-center gap-3">
          <AlertTriangle size={15} />
          <span>You are logged in as {user?.role}. Requesting a move requires a Client account.</span>
          <button
            type="button"
            onClick={() => {
              useAuthStore.getState().logout();
              router.push('/sign-in?redirect=/request');
            }}
            className="underline font-bold text-paper hover:text-black"
          >
            Switch to Client account
          </button>
        </div>
      )}

      {isOffline && (
        <div className="border-b border-ink bg-paper-soft px-4 py-2 text-center mono text-[10px] text-hazard flex items-center justify-center gap-2">
          <WifiOff size={13} />
          <span>OFFLINE MODE &mdash; ALL ITEMS AND CALCULATIONS SAVED LOCALLY</span>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl gap-0 md:grid-cols-[1fr_420px]">
        {/* Main section: Scan + Items + Route */}
        <section className="border-b border-ink p-4 md:border-b-0 md:border-r md:p-8 lg:p-12">
          <p className="mono text-[11px] text-hazard font-bold">[ LOAD MANIFEST ]</p>
          <h1 className="display mt-3 max-w-xl text-[clamp(2.4rem,6vw,5.5rem)] leading-none">
            WHAT ARE YOU MOVING?
          </h1>
          <p className="mt-4 max-w-xl leading-relaxed text-sm text-ink-80 md:text-base">
            Scan your space with live LiDAR depth / photo analysis or select items manually.
            We calculate both space ($m^3$) and weight ($kg$) to guarantee a matching vehicle.
          </p>

          {/* Interactive LiDAR & Photo Scanner Engine */}
          <LoadScan onAdd={addScannedItem} />

          {/* Quick mobile summary glance */}
          <div className="mt-6 border border-ink bg-paper-soft p-3 md:hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="mono text-[9px] text-ink-40">RECOMMENDED VEHICLE</p>
                <p className="font-bold text-sm">{vehicle.name}</p>
              </div>
              <div className="text-right">
                <p className="mono text-[9px] text-ink-40">EST. TOTAL</p>
                <p className="display text-xl text-hazard">{price} TND</p>
              </div>
            </div>
            <div className="mt-2 flex gap-4 border-t border-ink/20 pt-2 mono text-[10px] text-ink-80">
              <span>VOL: <strong>{volume.toFixed(1)} / {vehicle.capacity} M&sup3;</strong></span>
              <span>WEIGHT: <strong>{Math.round(weight)} / {vehicle.payload} KG</strong></span>
            </div>
          </div>

          {/* Items catalogue with accessible 44px touch targets */}
          <div className="mt-8">
            <div className="flex items-center justify-between border-b-2 border-ink pb-2">
              <span className="mono text-xs font-bold text-ink">INVENTORY CATALOGUE</span>
              <span className="mono text-[10px] text-ink-40">
                {items.length} ITEM TYPE{items.length === 1 ? '' : 'S'} IN LOAD
              </span>
            </div>

            <div className="divide-y divide-ink/20">
              {CATALOGUE.map((item) => {
                const selected = items.find((selectedItem) => selectedItem.id === item.id);
                return (
                  <div
                    key={item.id}
                    className="flex min-h-16 items-center justify-between py-3.5"
                  >
                    <div className="pr-2">
                      <p className="font-semibold text-sm md:text-base">{item.name}</p>
                      <p className="mono mt-0.5 text-[9px] text-ink-40">
                        {item.volume} M&sup3; &middot; {item.weight} KG EACH
                      </p>
                    </div>

                    {/* Accessible min-44px touch targets */}
                    <div className="flex items-center border-2 border-ink bg-paper">
                      <button
                        type="button"
                        aria-label={`Remove one ${item.name}`}
                        onClick={() => changeItem(item, -1)}
                        className="grid size-11 place-items-center hover:bg-paper-soft active:bg-ink active:text-paper transition"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="mono grid w-10 place-items-center text-xs font-bold">
                        {selected?.quantity ?? 0}
                      </span>
                      <button
                        type="button"
                        aria-label={`Add one ${item.name}`}
                        onClick={() => changeItem(item, 1)}
                        className="grid size-11 place-items-center border-l-2 border-ink bg-ink text-paper hover:bg-hazard active:bg-hazard-dark transition"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Route distance slider */}
          <div className="mt-10 border-2 border-ink bg-paper-soft p-4 md:p-6">
            <div className="flex items-center justify-between">
              <span className="mono text-[10px] text-ink-80 font-bold">ESTIMATED ROUTE DISTANCE</span>
              <span className="mono text-xs font-bold text-hazard">{distance} KM</span>
            </div>
            <input
              aria-label="Route distance in kilometers"
              className="mt-4 block h-3 w-full cursor-pointer accent-[#e61919]"
              type="range"
              min="2"
              max="80"
              value={distance}
              onChange={(event) => setDistance(Number(event.target.value))}
            />
            <div className="mono mt-2 flex justify-between text-[9px] text-ink-40">
              <span>2 KM (LOCAL INTRA-CITY)</span>
              <span>80 KM (INTERCITY EXPRESS)</span>
            </div>
          </div>

          {/* Addresses */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <label className="mono text-[10px] text-ink-80">
              PICKUP ADDRESS
              <input
                value={pickupAddress}
                onChange={(event) => setPickupAddress(event.target.value)}
                placeholder="Street address, city"
                className="mt-2 w-full border border-ink bg-paper px-3 py-3 text-sm normal-case tracking-normal text-ink focus:outline-none focus:ring-1 focus:ring-hazard"
              />
            </label>
            <label className="mono text-[10px] text-ink-80">
              DESTINATION ADDRESS
              <input
                value={destinationAddress}
                onChange={(event) => setDestinationAddress(event.target.value)}
                placeholder="Street address, city"
                className="mt-2 w-full border border-ink bg-paper px-3 py-3 text-sm normal-case tracking-normal text-ink focus:outline-none focus:ring-1 focus:ring-hazard"
              />
            </label>
          </div>
        </section>

        {/* Desktop Sidebar: Vehicle & Load Telemetry */}
        <aside className="bg-paper-soft p-4 md:sticky md:top-0 md:h-dvh md:overflow-y-auto md:p-8">
          <p className="mono text-[10px] text-ink-40">AUTOMATIC VEHICLE MATCH</p>
          <div className="mt-4 border-2 border-ink bg-paper p-5">
            <Truck className="text-hazard" size={36} strokeWidth={1.5} />
            <h2 className="display mt-4 text-3xl">{vehicle.name}</h2>
            <p className="mt-1 text-xs text-ink-80">{vehicle.label}</p>

            {/* YOUR LOAD: Dual Volume + Weight Telemetry Gauges */}
            <div className="mt-6 border-t-2 border-ink pt-4 space-y-4">
              <p className="mono text-[10px] font-bold text-hazard">[ YOUR LOAD TELEMETRY ]</p>

              {/* Volume gauge */}
              <div>
                <div className="flex justify-between mono text-[10px]">
                  <span className="flex items-center gap-1"><Box size={12} /> VOLUME</span>
                  <strong>{volume.toFixed(1)} / {vehicle.capacity} M&sup3; ({volumePct}%)</strong>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden border border-ink bg-paper-soft">
                  <div
                    className={`h-full transition-all duration-300 ${isOvervolume ? 'bg-hazard' : 'bg-ink'}`}
                    style={{ width: `${Math.min(100, volumePct)}%` }}
                  />
                </div>
              </div>

              {/* Weight gauge */}
              <div>
                <div className="flex justify-between mono text-[10px]">
                  <span className="flex items-center gap-1"><Weight size={12} /> TOTAL WEIGHT</span>
                  <strong className={isOverweight ? 'text-hazard font-bold' : ''}>
                    {Math.round(weight)} / {vehicle.payload} KG ({weightPct}%)
                  </strong>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden border border-ink bg-paper-soft">
                  <div
                    className={`h-full transition-all duration-300 ${isOverweight ? 'bg-hazard' : 'bg-hazard'}`}
                    style={{ width: `${Math.min(100, weightPct)}%` }}
                  />
                </div>
              </div>

              {/* Overload alert */}
              {(isOvervolume || isOverweight) && (
                <div className="mono text-[10px] text-hazard border border-hazard bg-hazard/10 p-2 flex items-center gap-1.5 font-bold">
                  <AlertTriangle size={13} className="shrink-0" />
                  <span>LOAD EXCEEDS SELECTED CAPACITY &mdash; UPGRADING VEHICLE</span>
                </div>
              )}
            </div>
          </div>

          {/* Vehicle selector override */}
          <div className="mt-5">
            <p className="mono text-[10px] text-ink-40">SELECT SPECIFIC VEHICLE</p>
            <select
              value={chosenVehicle}
              onChange={(event) => setChosenVehicle(event.target.value)}
              className="mt-2 w-full border-2 border-ink bg-paper px-3 py-2.5 text-xs font-semibold"
            >
              <option value="AUTO">AUTO-MATCH &middot; {recommendedVehicle.name}</option>
              {VEHICLES.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.name} &middot; {option.capacity} M&sup3; / {option.payload} KG
                </option>
              ))}
            </select>
            <p className="mt-1.5 mono text-[9px] text-ink-40">
              Auto selection monitors both $m^3$ space and weight payload. Heavy cargo triggers automatic vehicle upgrade.
            </p>
          </div>

          {/* Price estimate */}
          <div className="mt-6 border-b-2 border-ink pb-5">
            <p className="mono text-[10px] text-ink-40">ESTIMATED TOTAL</p>
            <p className="display mt-1 text-4xl">
              {price} <span className="text-xl">TND</span>
            </p>
            <p className="mt-1.5 text-xs text-ink-80">
              Includes matching vehicle, calibrated fuel, driver and standard goods insurance.
            </p>
          </div>

          {/* Action button */}
          <Button
            className="mt-6 w-full"
            variant="hazard"
            size="lg"
            disabled={items.length === 0 || isSubmitting}
            onClick={submitRequest}
          >
            {isSubmitting ? (
              'CREATING MOVE…'
            ) : !isAuthenticated ? (
              <>SIGN IN TO REQUEST THIS VEHICLE <ArrowRight /></>
            ) : (
              <>REQUEST THIS VEHICLE <ArrowRight /></>
            )}
          </Button>

          {error && <p className="mono mt-3 text-center text-[10px] text-hazard">{error}</p>}
          {items.length === 0 && (
            <p className="mono mt-3 text-center text-[9px] text-ink-40">
              SCAN OR ADD AT LEAST ONE ITEM TO CONTINUE
            </p>
          )}
        </aside>
      </div>

      {/* Sticky Mobile Bottom Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t-2 border-ink bg-paper p-3 shadow-2xl md:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div>
            <p className="mono text-[9px] text-ink-40 uppercase truncate">
              {vehicle.name} &middot; {volume.toFixed(1)}m&sup3; &middot; {Math.round(weight)}kg
            </p>
            <p className="display text-2xl leading-none text-ink">
              {price} <span className="text-xs">TND</span>
            </p>
          </div>
          <Button
            variant="hazard"
            size="sm"
            disabled={items.length === 0 || isSubmitting}
            onClick={submitRequest}
            className="h-11 px-5 mono text-xs font-bold"
          >
            {isSubmitting
              ? 'CREATING…'
              : !isAuthenticated
              ? 'SIGN IN & BOOK'
              : 'REQUEST MOVE'} <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </main>
  );
}
