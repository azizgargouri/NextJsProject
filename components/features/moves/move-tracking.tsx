'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Clock3, Navigation, Phone } from 'lucide-react';
import { MoveRouteMap } from './move-route-map';

type StageState = 'done' | 'active' | 'upcoming';
type MoveData = { reference: string; pickupAddress: string; destinationAddress: string; estimatedPrice: number; volume: number; vehicle: { name: string; capacity: number }; mover: { name: string; phone: string; companyName: string }; currentStage: string; stages: { key: string; title: string; detail: string; durationMinutes: number | null; estimatedAt: string; completedAt: string | null }[] };

const MOVE_STAGES: { title: string; detail: string; time: string; state: StageState; duration?: string }[] = [
  { title: 'Booking confirmed', detail: 'Your move request has been accepted.', time: '09:00', state: 'done' },
  { title: 'Vehicle assigned', detail: 'Moving van · 14 m³ · Mehdi B.', time: '09:12', state: 'done' },
  { title: 'Driver en route', detail: 'Driver is travelling to your pickup location.', time: 'NOW', state: 'active', duration: '18 min remaining' },
  { title: 'Vehicle arrives', detail: 'Driver arrives at 12 Rue du Lac.', time: '09:38', state: 'upcoming', duration: 'estimated' },
  { title: 'Loading starts', detail: 'Furniture and boxes are checked and loaded.', time: '09:43', state: 'upcoming', duration: '45 min estimated' },
  { title: 'In transit', detail: 'Your load is on the road to La Marsa.', time: '10:28', state: 'upcoming', duration: '26 min estimated' },
  { title: 'Delivery', detail: 'Unloading at the destination address.', time: '10:54', state: 'upcoming', duration: '35 min estimated' },
  { title: 'Move completed', detail: 'Confirm delivery or report a problem.', time: '11:29', state: 'upcoming' },
];

function StageMarker({ state }: { state: StageState }) {
  if (state === 'done') return <span className="grid size-6 place-items-center border-2 border-ink bg-ink text-paper"><Check size={13} strokeWidth={3} /></span>;
  if (state === 'active') return <span className="grid size-6 place-items-center border-2 border-ink bg-hazard"><span className="size-2 animate-pulse bg-paper" /></span>;
  return <span className="size-6 border-2 border-ink bg-paper" />;
}

export function MoveTracking({ moveId, trackingToken }: { moveId?: string; trackingToken?: string }) {
  const [minutes, setMinutes] = useState(18);
  const [move, setMove] = useState<MoveData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setMinutes((value) => Math.max(1, value - 1)), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!moveId || !trackingToken) return;
    const load = async () => {
      try { const response = await fetch(`/api/moves/${moveId}?token=${encodeURIComponent(trackingToken)}`); const body = await response.json(); if (!response.ok) throw new Error(body.message ?? 'Could not load your move'); setMove(body.move); } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not load your move'); }
    };
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, [moveId, trackingToken]);

  const matchedStageIndex = move ? move.stages.findIndex((stage) => stage.key === move.currentStage) : 2;
  const currentIndex = matchedStageIndex >= 0 ? matchedStageIndex : 0;
  const displayStages = move ? move.stages.map((stage, index) => ({ title: stage.title, detail: stage.detail, time: index <= currentIndex && stage.completedAt ? new Date(stage.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(stage.estimatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), state: index < currentIndex ? 'done' as const : index === currentIndex ? 'active' as const : 'upcoming' as const, duration: stage.durationMinutes ? `${stage.durationMinutes} min estimated` : undefined })) : MOVE_STAGES;
  const currentStage = displayStages[currentIndex] ?? displayStages[0] ?? MOVE_STAGES[0]!;

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="border-b border-ink px-4 py-4 md:px-6"><div className="mx-auto flex max-w-7xl items-center justify-between"><Link href="/" className="mono text-sm font-bold"><span className="mr-2 inline-block size-2.5 bg-hazard" />MOVE<span className="text-hazard">UP</span></Link><p className="mono text-[10px] text-ink-40">LIVE MOVE / {move?.reference ?? 'LOADING'}</p></div></header>
      <div className="mx-auto grid max-w-7xl md:grid-cols-[minmax(0,1fr)_430px]">
        <section className="border-b border-ink md:border-b-0 md:border-r">
          <MoveRouteMap pickupLabel={move?.pickupAddress ?? 'Pickup address'} destinationLabel={move?.destinationAddress ?? 'Delivery address'} currentStageIndex={currentIndex} totalStages={displayStages.length} />
          <div className="grid border-t border-ink sm:grid-cols-2"><div className="border-b border-ink p-5 sm:border-b-0 sm:border-r md:p-7"><p className="mono text-[9px] text-ink-40">PICKUP</p><p className="mt-2 font-semibold">{move?.pickupAddress ?? '12 Rue du Lac, Les Berges du Lac'}</p><p className="mt-1 text-sm text-ink-80">Driver confirms arrival in the timeline.</p></div><div className="p-5 md:p-7"><p className="mono text-[9px] text-ink-40">DELIVERY</p><p className="mt-2 font-semibold">{move?.destinationAddress ?? '8 Avenue Habib Bourguiba, La Marsa'}</p><p className="mt-1 text-sm text-ink-80">Driver will call on arrival.</p></div></div>
        </section>
        <aside className="p-5 md:p-8">
          <div className="border-b-2 border-ink pb-6">
            <p className="mono text-[10px] text-hazard font-bold">CURRENT STAGE / {currentStage.title.toUpperCase()}</p>
            <h1 className="display mt-3 text-4xl sm:text-5xl leading-none">NEXT UPDATE<br />IN {minutes} MIN.</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-ink-80">{currentStage.detail}</p>
            {loadError && <p className="mono mt-3 text-[10px] text-hazard">{loadError}</p>}
            <div className="mt-5 flex items-center justify-between border border-ink bg-paper-soft p-3">
              <div>
                <p className="mono text-[9px] text-ink-40">DRIVER / VEHICLE</p>
                <p className="mt-1 text-sm font-semibold">{move ? `${move.mover.name} · ${move.vehicle.name} ${move.vehicle.capacity} m³` : 'Mehdi B. · Moving van 14 m³'}</p>
              </div>
              <a
                href={move?.mover?.phone ? `tel:${move.mover.phone}` : '#'}
                className="grid size-11 shrink-0 place-items-center border-2 border-ink bg-paper hover:bg-ink hover:text-paper transition active:bg-hazard active:text-white"
                aria-label="Call driver"
              >
                <Phone size={18} />
              </a>
            </div>
          </div>
          <div className="mt-7">
            <div className="flex items-center justify-between">
              <p className="mono text-[10px] text-ink-40">MOVE TIMELINE</p>
              <p className="mono flex items-center gap-1 text-[9px] text-ink-40"><Clock3 size={12} /> ESTIMATES UPDATE LIVE</p>
            </div>
            <ol className="mt-5">
              {displayStages.map((stage, index) => (
                <li key={stage.title} className="relative grid grid-cols-[26px_1fr_auto] gap-x-3 pb-6 last:pb-0">
                  {index < displayStages.length - 1 && (
                    <span className={`absolute left-[11px] top-6 h-[calc(100%-8px)] w-px ${stage.state === 'done' ? 'bg-ink' : 'bg-ink/20'}`} />
                  )}
                  <StageMarker state={stage.state} />
                  <div className="pb-0.5">
                    <p className={`mono text-[11px] font-bold ${stage.state === 'upcoming' ? 'text-ink-40' : 'text-ink'}`}>{stage.title.toUpperCase()}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-80">{stage.detail}</p>
                    {stage.duration && (
                      <p className={`mono mt-2 text-[9px] ${stage.state === 'active' ? 'text-hazard font-bold' : 'text-ink-40'}`}>{stage.state === 'active' ? `${minutes} MIN REMAINING` : stage.duration.toUpperCase()}</p>
                    )}
                  </div>
                  <time className={`mono pt-0.5 text-[10px] ${stage.state === 'active' ? 'text-hazard font-bold' : stage.state === 'upcoming' ? 'text-ink-40' : 'text-ink'}`}>{stage.time}</time>
                </li>
              ))}
            </ol>
          </div>
          <button
            onClick={() => {
              const pickup = encodeURIComponent(move?.pickupAddress ?? '12 Rue du Lac, Les Berges du Lac');
              const dest = encodeURIComponent(move?.destinationAddress ?? '8 Avenue Habib Bourguiba, La Marsa');
              window.open(`https://www.google.com/maps/dir/?api=1&origin=${pickup}&destination=${dest}`, '_blank');
            }}
            className="mono mt-8 flex w-full items-center justify-center gap-2 border-2 border-ink py-3.5 text-xs font-bold hover:bg-ink hover:text-paper active:bg-hazard active:text-white transition"
          >
            <Navigation size={16} /> OPEN ROUTE IN MAPS
          </button>
        </aside>
      </div>
    </main>
  );
}
