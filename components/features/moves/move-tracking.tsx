'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Clock3,
  Phone,
  Search,
  Truck,
  ArrowRight,
  AlertTriangle,
  Play,
  Sparkles,
  Package,
  MessageSquare,
  Navigation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoveRouteMap } from './move-route-map';
import { ProofOfDeliveryModal } from './proof-of-delivery-modal';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { api } from '@/lib/api';
import type { MoveDataDto, MoveStageDto } from '@/lib/api/moves';

type StageState = 'done' | 'active' | 'upcoming';

const FALLBACK_STAGES: MoveStageDto[] = [
  { key: 'CONFIRMED', title: 'Booking confirmed', detail: 'Your move request has been confirmed and scheduled.', durationMinutes: 0, estimatedAt: new Date(Date.now() - 3600000).toISOString(), completedAt: new Date(Date.now() - 3600000).toISOString() },
  { key: 'ASSIGNED', title: 'Vehicle assigned', detail: 'Moving van · 14 m³ · Mehdi Transport assigned.', durationMinutes: 12, estimatedAt: new Date(Date.now() - 2400000).toISOString(), completedAt: new Date(Date.now() - 2400000).toISOString() },
  { key: 'EN_ROUTE', title: 'Driver en route', detail: 'Driver is travelling to your pickup location.', durationMinutes: 18, estimatedAt: new Date().toISOString(), completedAt: null },
  { key: 'ARRIVED', title: 'Vehicle arrives', detail: 'Driver arrives at 12 Rue du Lac.', durationMinutes: 5, estimatedAt: new Date(Date.now() + 1080000).toISOString(), completedAt: null },
  { key: 'LOADING', title: 'Loading starts', detail: 'Furniture and boxes are checked and loaded.', durationMinutes: 45, estimatedAt: new Date(Date.now() + 1380000).toISOString(), completedAt: null },
  { key: 'IN_TRANSIT', title: 'In transit', detail: 'Your load is on the road to destination.', durationMinutes: 26, estimatedAt: new Date(Date.now() + 4080000).toISOString(), completedAt: null },
  { key: 'DELIVERY', title: 'Delivery', detail: 'Unloading items at the delivery address.', durationMinutes: 35, estimatedAt: new Date(Date.now() + 5640000).toISOString(), completedAt: null },
  { key: 'COMPLETED', title: 'Move completed', detail: 'Confirm delivery or report a problem.', durationMinutes: null, estimatedAt: new Date(Date.now() + 7740000).toISOString(), completedAt: null },
];

function StageMarker({ state }: { state: StageState }) {
  if (state === 'done') {
    return (
      <span className="grid size-6 place-items-center border-2 border-ink bg-ink text-paper">
        <Check size={13} strokeWidth={3} />
      </span>
    );
  }
  if (state === 'active') {
    return (
      <span className="grid size-6 place-items-center border-2 border-ink bg-hazard shadow-[0_0_8px_#e61919]">
        <span className="size-2 animate-pulse bg-paper" />
      </span>
    );
  }
  return <span className="size-6 border-2 border-ink bg-paper" />;
}

export function MoveTracking({
  moveId,
  trackingToken,
}: {
  moveId?: string;
  trackingToken?: string;
}) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [searchInput, setSearchInput] = useState(moveId || '');
  const [activeIdentifier, setActiveIdentifier] = useState(moveId || '');
  const [token, setToken] = useState(trackingToken || '');
  const [move, setMove] = useState<MoveDataDto | null>(null);
  const [userMoves, setUserMoves] = useState<MoveDataDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(14);
  const [showPodModal, setShowPodModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Load user's active moves if signed in
  useEffect(() => {
    if (!isAuthenticated) return;
    api.moves
      .list()
      .then((res) => {
        if (res.moves && res.moves.length > 0) {
          setUserMoves(res.moves);
          // If no specific moveId provided in URL, automatically select the most recent
          if (!moveId && !activeIdentifier) {
            setActiveIdentifier(res.moves[0]!.reference);
            setToken(res.moves[0]!.trackingToken || '');
          }
        }
      })
      .catch(() => {});
  }, [isAuthenticated, moveId, activeIdentifier]);

  // Fetch move data whenever activeIdentifier changes
  useEffect(() => {
    if (!activeIdentifier) return;

    let cancelled = false;
    const fetchMove = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await api.moves.getOne(activeIdentifier, token);
        if (!cancelled && res.move) {
          setMove(res.move);
          if (res.move.trackingToken) setToken(res.move.trackingToken);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          setLoadError(msg || 'Could not find move with this reference code or link.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void fetchMove();
    const interval = setInterval(fetchMove, 20_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeIdentifier, token]);

  // ETA countdown simulation
  useEffect(() => {
    const timer = window.setInterval(() => setMinutes((v) => Math.max(1, v - 1)), 45_000);
    return () => window.clearInterval(timer);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setActiveIdentifier(searchInput.trim());
    router.push(`/track/${encodeURIComponent(searchInput.trim())}`);
  };

  const handleAdvanceStage = async (nextStageKey: string) => {
    if (!move) return;
    if (nextStageKey === 'COMPLETED') {
      setShowPodModal(true);
      return;
    }
    executeAdvanceStage(nextStageKey);
  };

  const executeAdvanceStage = async (stageKey: string) => {
    if (!move) return;
    startTransition(async () => {
      try {
        const res = await api.moves.advance(move.id, stageKey);
        setMove(res.move);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setLoadError(msg || 'Failed to advance stage');
      }
    });
  };

  const currentStages = move?.stages ?? FALLBACK_STAGES;
  const matchedStageIndex = move
    ? currentStages.findIndex((s) => s.key === move.currentStage)
    : 2;
  const currentIndex = matchedStageIndex >= 0 ? matchedStageIndex : 2;

  const displayStages = currentStages.map((stage, index) => ({
    key: stage.key,
    title: stage.title,
    detail: stage.detail,
    time:
      index <= currentIndex && stage.completedAt
        ? new Date(stage.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date(stage.estimatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    state: (index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'upcoming') as StageState,
    duration: stage.durationMinutes ? `${stage.durationMinutes} min estimated` : undefined,
  }));

  const activeStage = displayStages[currentIndex] ?? displayStages[0]!;
  const nextStage = currentIndex < displayStages.length - 1 ? displayStages[currentIndex + 1] : null;

  const canAdvance =
    user?.role === 'ADMIN' ||
    user?.role === 'MOVER' ||
    (user?.role === 'CLIENT' && nextStage?.key === 'COMPLETED');

  return (
    <main className="min-h-dvh bg-paper text-ink pb-12">
      {/* Top Navbar Header */}
      <header className="border-b border-ink bg-paper px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="mono text-sm font-bold flex items-center gap-2">
              <span className="inline-block size-2.5 bg-hazard" />
              MOVE<span className="text-hazard">UP</span>
            </Link>
            <span className="mono text-[10px] text-ink-40">/ LIVE TELEMETRY</span>
          </div>

          {/* Reference Search input */}
          <form onSubmit={handleSearch} className="flex items-center border-2 border-ink bg-paper">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ENTER MOVE REF (e.g. MU-2026-XXXXXX)"
              className="mono px-3 py-1.5 text-xs focus:outline-none w-56 sm:w-72"
            />
            <button
              type="submit"
              className="mono bg-ink text-paper px-3 py-1.5 text-xs font-bold hover:bg-hazard transition flex items-center gap-1 shrink-0"
            >
              <Search size={13} /> TRACK
            </button>
          </form>
        </div>
      </header>

      {/* User's Active Moves bar (if signed in) */}
      {userMoves.length > 0 && (
        <div className="border-b border-ink bg-paper-soft px-4 py-2.5">
          <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto text-xs">
            <span className="mono text-[10px] text-ink-60 shrink-0 font-bold">YOUR ACTIVE MOVES:</span>
            {userMoves.map((m) => {
              const isSelected = move?.reference === m.reference;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setActiveIdentifier(m.reference);
                    setSearchInput(m.reference);
                    setToken(m.trackingToken || '');
                  }}
                  className={`mono inline-flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-bold transition shrink-0 ${
                    isSelected ? 'border-hazard bg-hazard text-white' : 'border-ink bg-paper hover:bg-ink hover:text-paper'
                  }`}
                >
                  <Truck size={12} />
                  <span>{m.reference}</span>
                  <span className="opacity-80">({m.currentStage})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Grid: Interactive Map + Live Timeline */}
      <div className="mx-auto grid max-w-7xl md:grid-cols-[minmax(0,1fr)_440px]">
        {/* Left Column: GPS Map & Addresses */}
        <section className="border-b border-ink md:border-b-0 md:border-r">
          <MoveRouteMap
            pickupLabel={move?.pickupAddress ?? '12 Rue du Lac, Les Berges du Lac'}
            destinationLabel={move?.destinationAddress ?? '8 Avenue Habib Bourguiba, La Marsa'}
            currentStageIndex={currentIndex}
            totalStages={displayStages.length}
          />

          <div className="grid border-t border-ink sm:grid-cols-2">
            <div className="border-b border-ink p-5 sm:border-b-0 sm:border-r md:p-6">
              <div className="flex items-center justify-between">
                <p className="mono text-[10px] text-hazard font-bold">01 / PICKUP POINT</p>
                <span className="mono text-[9px] text-ink-40">ORIGIN</span>
              </div>
              <p className="mt-2 font-bold text-sm md:text-base">
                {move?.pickupAddress ?? '12 Rue du Lac, Les Berges du Lac, Tunis'}
              </p>
              <p className="mt-1 text-xs text-ink-80">
                Driver arrives with assigned {move?.vehicle?.name ?? 'Moving van'}.
              </p>
            </div>

            <div className="p-5 md:p-6">
              <div className="flex items-center justify-between">
                <p className="mono text-[10px] text-hazard font-bold">02 / DESTINATION</p>
                <span className="mono text-[9px] text-ink-40">DELIVERY</span>
              </div>
              <p className="mt-2 font-bold text-sm md:text-base">
                {move?.destinationAddress ?? '8 Avenue Habib Bourguiba, La Marsa'}
              </p>
              <p className="mt-1 text-xs text-ink-80">
                Driver will call on arrival for gated entry.
              </p>
            </div>
          </div>

          {/* Load Inventory Manifest */}
          {move?.items && move.items.length > 0 && (
            <div className="border-t border-ink p-5 md:p-6 bg-paper-soft">
              <p className="mono text-[10px] text-ink-60 font-bold mb-3 flex items-center gap-1.5">
                <Package size={13} className="text-hazard" />
                VERIFIED LOAD MANIFEST ({move.items.length} ITEMS &middot; {move.volume} M&sup3;)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mono text-xs">
                {move.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between border border-ink/40 bg-paper p-2">
                    <span className="font-semibold">{item.name} &times; {item.quantity}</span>
                    <span className="text-ink-60">{(item.volume * item.quantity).toFixed(2)}m&sup3; &middot; {item.weight * item.quantity}kg</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Live Status & Stage Advancer */}
        <aside className="p-5 md:p-8">
          <div className="border-b-2 border-ink pb-6">
            <div className="flex items-center justify-between">
              <p className="mono text-[10px] text-hazard font-bold">
                REF / {move?.reference ?? 'MU-2026-DEMO'}
              </p>
              {isLoading && <span className="mono text-[10px] text-hazard animate-pulse">REFRESHING…</span>}
            </div>

            <h1 className="display mt-3 text-4xl sm:text-5xl leading-none">
              {activeStage.key === 'COMPLETED' ? (
                <>MOVE<br />DELIVERED.</>
              ) : (
                <>NEXT UPDATE<br />IN {minutes} MIN.</>
              )}
            </h1>

            <p className="mt-3 text-sm leading-6 text-ink-80 font-medium">
              {activeStage.detail}
            </p>

            {loadError && (
              <div className="mono mt-3 border border-hazard bg-hazard/10 p-2.5 text-[11px] text-hazard">
                {loadError}
              </div>
            )}

            {/* Mover & Driver card with 1-Click WhatsApp & GPS navigation */}
            <div className="mt-5 border-2 border-ink bg-paper-soft p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="mono text-[9px] text-ink-40">ASSIGNED OPERATOR &amp; VEHICLE</p>
                  <p className="mt-0.5 text-sm font-bold">
                    {move?.mover?.name ?? 'Mehdi Transport'} &middot; {move?.vehicle?.name ?? 'Moving van (14 m³)'}
                  </p>
                  <p className="mono mt-0.5 text-[10px] text-ink-60">
                    {move?.estimatedPrice ? `${move.estimatedPrice} TND ALL-INCLUSIVE` : '185 TND ALL-INCLUSIVE'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* WhatsApp Quick Message */}
                  <a
                    href={`https://wa.me/${(move?.mover?.phone ?? '+21698123456').replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Hello, I am tracking move ${move?.reference ?? ''}. What is your current status?`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid size-10 place-items-center border-2 border-ink bg-emerald-600 text-white hover:bg-emerald-700 transition"
                    title="Chat on WhatsApp"
                    aria-label="WhatsApp driver"
                  >
                    <MessageSquare size={16} />
                  </a>

                  {/* Direct Google Maps / Waze Route */}
                  <a
                    href="https://www.google.com/maps/dir/?api=1&destination=36.8782,10.3255"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid size-10 place-items-center border-2 border-ink bg-ink text-paper hover:bg-hazard transition"
                    title="Open GPS Navigation"
                    aria-label="GPS Navigation"
                  >
                    <Navigation size={16} />
                  </a>

                  {/* Phone Call */}
                  <a
                    href={move?.mover?.phone ? `tel:${move.mover.phone}` : 'tel:+21698123456'}
                    className="grid size-10 place-items-center border-2 border-ink bg-paper hover:bg-ink hover:text-paper transition active:bg-hazard active:text-white"
                    aria-label="Call driver"
                  >
                    <Phone size={16} />
                  </a>
                </div>
              </div>
            </div>

            {/* Stage Progress Controller (For Mover, Admin, or Testing) */}
            {move && nextStage && (
              <div className="mt-4 border border-dashed border-hazard bg-hazard/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="mono text-[9px] font-bold text-hazard">
                    LIVE PIPELINE CONTROLLER
                  </span>
                  <span className="mono text-[9px] text-ink-40">
                    {canAdvance ? 'OPERATOR PERMITTED' : 'DEMO MODE'}
                  </span>
                </div>
                <Button
                  variant="hazard"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleAdvanceStage(nextStage.key)}
                  className="mt-2 w-full mono text-xs font-bold justify-between"
                >
                  <span>ADVANCE &rarr; {nextStage.title.toUpperCase()}</span>
                  <Play size={13} />
                </Button>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="mt-7">
            <div className="flex items-center justify-between">
              <p className="mono text-[10px] text-ink-40 font-bold">MOVE PROGRESSION TIMELINE</p>
              <p className="mono flex items-center gap-1 text-[9px] text-ink-40">
                <Clock3 size={12} /> REAL-TIME TELEMETRY
              </p>
            </div>

            <ol className="mt-5">
              {displayStages.map((stage, index) => (
                <li
                  key={stage.title}
                  className="relative grid grid-cols-[26px_1fr_auto] gap-x-3 pb-6 last:pb-0"
                >
                  {index < displayStages.length - 1 && (
                    <span
                      className={`absolute left-[11px] top-6 h-[calc(100%-8px)] w-px ${
                        stage.state === 'done' ? 'bg-ink' : 'bg-ink/20'
                      }`}
                    />
                  )}
                  <StageMarker state={stage.state} />
                  <div className="pb-0.5">
                    <p
                      className={`mono text-[11px] font-bold ${
                        stage.state === 'upcoming' ? 'text-ink-40' : 'text-ink'
                      }`}
                    >
                      {stage.title.toUpperCase()}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-ink-80">{stage.detail}</p>
                    {stage.duration && (
                      <p
                        className={`mono mt-1 text-[9px] ${
                          stage.state === 'active' ? 'text-hazard font-bold' : 'text-ink-40'
                        }`}
                      >
                        {stage.state === 'active' ? `${minutes} MIN REMAINING` : stage.duration.toUpperCase()}
                      </p>
                    )}
                  </div>
                  <time
                    className={`mono pt-0.5 text-[10px] ${
                      stage.state === 'active'
                        ? 'text-hazard font-bold'
                        : stage.state === 'upcoming'
                        ? 'text-ink-40'
                        : 'text-ink'
                    }`}
                  >
                    {stage.time}
                  </time>
                </li>
              ))}
            </ol>
          </div>

          {/* Post-Move Quality Actions */}
          <div className="mt-8 border-t-2 border-ink pt-5 space-y-2">
            <p className="mono text-[10px] text-ink-40 font-bold uppercase mb-2">QUALITY &amp; ASSISTANCE</p>
            <Link
              href={`/dashboard/claims/new?moveRef=${encodeURIComponent(move?.reference ?? '')}&moverId=${encodeURIComponent(move?.mover?.userId ?? '')}`}
              className="mono flex items-center justify-between border border-ink p-3 text-xs hover:bg-ink hover:text-paper transition"
            >
              <span className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-hazard" />
                REPORT AN ISSUE / OPEN A CLAIM
              </span>
              <ArrowRight size={13} />
            </Link>

            <Link
              href={`/dashboard/reviews?moveRef=${encodeURIComponent(move?.reference ?? '')}&moverId=${encodeURIComponent(move?.mover?.userId ?? '')}`}
              className="mono flex items-center justify-between border border-ink p-3 text-xs hover:bg-ink hover:text-paper transition"
            >
              <span className="flex items-center gap-2">
                <Sparkles size={14} className="text-hazard" />
                RATE YOUR MOVER &amp; SERVICE
              </span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </aside>
      </div>

      {/* Proof of Delivery Digital Signature Modal */}
      <ProofOfDeliveryModal
        open={showPodModal}
        onClose={() => setShowPodModal(false)}
        onConfirm={(_signatureDataUrl) => {
          executeAdvanceStage('COMPLETED');
        }}
        moveReference={move?.reference ?? 'MU-2026-DEMO'}
        moverName={move?.mover?.name ?? 'Mehdi Transport'}
      />
    </main>
  );
}
