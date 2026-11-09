'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Search,
  Truck,
  RotateCcw,
  ExternalLink,
  Package,
  AlertCircle,
  Play,
} from 'lucide-react';
import { AdminBadge } from '@/components/ui/admin-badge';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminCard } from '@/components/ui/admin-card';
import { AdminInput } from '@/components/ui/admin-input';
import { AdminSelect } from '@/components/ui/admin-select';
import { api } from '@/lib/api';
import type { MoveDataDto } from '@/lib/api/moves';
import { useAdminShell } from '../shell/admin-shell-context';

const STAGE_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmed',
  ASSIGNED: 'Vehicle Assigned',
  EN_ROUTE: 'Driver En Route',
  ARRIVED: 'Vehicle Arrived',
  LOADING: 'Loading Cargo',
  IN_TRANSIT: 'In Transit',
  DELIVERY: 'Unloading / Delivery',
  COMPLETED: 'Delivered & Complete',
};

const STAGE_BADGE_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive' | 'success'
> = {
  CONFIRMED: 'outline',
  ASSIGNED: 'secondary',
  EN_ROUTE: 'default',
  ARRIVED: 'secondary',
  LOADING: 'default',
  IN_TRANSIT: 'destructive',
  DELIVERY: 'default',
  COMPLETED: 'success',
};

const STAGES_ORDER = [
  'CONFIRMED',
  'ASSIGNED',
  'EN_ROUTE',
  'ARRIVED',
  'LOADING',
  'IN_TRANSIT',
  'DELIVERY',
  'COMPLETED',
];

export function MovesPortal() {
  const { setPage: publishPage, clearPage, clearFooter } = useAdminShell();
  const [moves, setMoves] = useState<MoveDataDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selectedMove, setSelectedMove] = useState<MoveDataDto | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchMoves = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.moves.list();
      setMoves(res.moves ?? []);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to fetch move requests from backend');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    publishPage({
      breadcrumbs: [{ label: 'Operations' }, { label: 'Move requests' }],
      title: 'Move requests',
      description: 'Supervise, track, and advance live customer moves across Greater Tunis.',
      actions: (
        <AdminButton
          variant="outline"
          size="sm"
          onClick={fetchMoves}
          className="mono text-xs"
        >
          <RotateCcw size={12} className={`mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </AdminButton>
      ),
    });
    return () => {
      clearPage();
      clearFooter();
    };
  }, [publishPage, clearPage, clearFooter, isLoading]);

  useEffect(() => {
    void fetchMoves();
  }, []);

  const handleAdvanceStage = (moveId: string, nextStage: string) => {
    startTransition(async () => {
      try {
        const res = await api.moves.advance(moveId, nextStage);
        setMoves((prev) =>
          prev.map((m) => (m.id === moveId ? { ...m, ...res.move } : m)),
        );
        if (selectedMove?.id === moveId) {
          setSelectedMove(res.move);
        }
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg || 'Failed to update stage');
      }
    });
  };

  // Filter moves
  const filtered = moves.filter((m) => {
    if (stageFilter !== 'ALL' && m.currentStage !== stageFilter) return false;
    if (search.trim()) {
      const term = search.toLowerCase();
      const matchRef = m.reference.toLowerCase().includes(term);
      const matchPickup = m.pickupAddress.toLowerCase().includes(term);
      const matchDest = m.destinationAddress.toLowerCase().includes(term);
      const matchMover = m.mover?.name.toLowerCase().includes(term);
      if (!matchRef && !matchPickup && !matchDest && !matchMover) return false;
    }
    return true;
  });

  const totalMoves = moves.length;
  const inTransitCount = moves.filter((m) => m.currentStage === 'IN_TRANSIT').length;
  const activeCount = moves.filter((m) => m.currentStage !== 'COMPLETED').length;
  const totalRevenue = moves.reduce((acc, m) => acc + (m.estimatedPrice || 0), 0);

  return (
    <div className="space-y-6">
      {/* KPI Overview Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminCard className="p-4">
          <p className="mono text-[10px] text-muted-foreground uppercase font-semibold">Active Moves</p>
          <p className="display mt-1 text-3xl font-bold">{activeCount}</p>
          <p className="mono text-[10px] text-hazard mt-1">{inTransitCount} currently in transit</p>
        </AdminCard>

        <AdminCard className="p-4">
          <p className="mono text-[10px] text-muted-foreground uppercase font-semibold">Live Telemetry</p>
          <p className="display mt-1 text-3xl font-bold text-hazard">{inTransitCount}</p>
          <p className="mono text-[10px] text-muted-foreground mt-1">Real-time GPS on RN9 Corridor</p>
        </AdminCard>

        <AdminCard className="p-4">
          <p className="mono text-[10px] text-muted-foreground uppercase font-semibold">Completed</p>
          <p className="display mt-1 text-3xl font-bold">
            {moves.filter((m) => m.currentStage === 'COMPLETED').length}
          </p>
          <p className="mono text-[10px] text-emerald-600 mt-1">Delivered & verified</p>
        </AdminCard>

        <AdminCard className="p-4">
          <p className="mono text-[10px] text-muted-foreground uppercase font-semibold">Gross Estimated</p>
          <p className="display mt-1 text-3xl font-bold">{totalRevenue} <span className="text-sm font-normal">TND</span></p>
          <p className="mono text-[10px] text-muted-foreground mt-1">Across {totalMoves} booked orders</p>
        </AdminCard>
      </div>

      {error && (
        <div className="flex items-center gap-2 border border-hazard bg-hazard/10 p-3 mono text-xs text-hazard">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-72">
            <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <AdminInput
              placeholder="Search reference, address, mover…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>

          <AdminSelect
            value={stageFilter}
            onValueChange={setStageFilter}
            options={[
              { value: 'ALL', label: `All Stages (${moves.length})` },
              ...STAGES_ORDER.map((s) => ({ value: s, label: STAGE_LABELS[s] || s })),
            ]}
            ariaLabel="Filter moves by stage"
            className="w-48 text-xs"
          />
        </div>

        <div className="mono text-xs text-muted-foreground">
          Showing {filtered.length} of {moves.length} moves
        </div>
      </div>

      {/* Main Moves Table */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className={`${selectedMove ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
          <AdminCard className="overflow-hidden border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 mono text-[10px] text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Pickup &rarr; Delivery</th>
                    <th className="px-4 py-3">Vehicle / Mover</th>
                    <th className="px-4 py-3">Volume</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground mono">
                        {isLoading ? 'Loading move operations…' : 'No move records matching this criteria.'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((move) => {
                      const isSelected = selectedMove?.id === move.id;
                      const nextStageIdx = STAGES_ORDER.indexOf(move.currentStage) + 1;
                      const nextStage = nextStageIdx < STAGES_ORDER.length ? STAGES_ORDER[nextStageIdx] : null;

                      return (
                        <tr
                          key={move.id}
                          onClick={() => setSelectedMove(move)}
                          className={`cursor-pointer transition hover:bg-muted/30 ${
                            isSelected ? 'bg-muted/50 font-medium' : ''
                          }`}
                        >
                          <td className="px-4 py-3 mono font-bold">
                            <span className="text-foreground">{move.reference}</span>
                          </td>

                          <td className="px-4 py-3">
                            <AdminBadge variant={STAGE_BADGE_VARIANT[move.currentStage] ?? 'default'}>
                              {move.currentStage === 'IN_TRANSIT' && (
                                <span className="size-1.5 rounded-full bg-white animate-pulse mr-1" />
                              )}
                              {STAGE_LABELS[move.currentStage] ?? move.currentStage}
                            </AdminBadge>
                          </td>

                          <td className="px-4 py-3 max-w-[200px]">
                            <p className="truncate font-medium">{move.pickupAddress}</p>
                            <p className="truncate text-muted-foreground text-[11px]">&rarr; {move.destinationAddress}</p>
                          </td>

                          <td className="px-4 py-3">
                            <p className="font-medium">{move.mover?.name ?? 'Assigned Mover'}</p>
                            <p className="mono text-[10px] text-muted-foreground">{move.vehicle?.name}</p>
                          </td>

                          <td className="px-4 py-3 mono">
                            <span>{move.volume} m&sup3;</span>
                            {move.items && move.items.length > 0 && (
                              <span className="text-muted-foreground text-[10px] block">
                                {move.items.length} items
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 mono font-bold text-foreground">
                            {move.estimatedPrice} TND
                          </td>

                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/track/${encodeURIComponent(move.reference)}`}
                                target="_blank"
                                className="mono text-[10px] inline-flex items-center gap-1 border border-border px-2 py-1 hover:bg-foreground hover:text-background transition"
                                title="Open Live Telemetry"
                              >
                                <ExternalLink size={11} /> TRACK
                              </Link>

                              {nextStage && (
                                <AdminButton
                                  variant="outline"
                                  size="sm"
                                  disabled={isPending}
                                  onClick={() => handleAdvanceStage(move.id, nextStage)}
                                  className="mono text-[10px] h-6 px-1.5"
                                  title={`Advance to ${STAGE_LABELS[nextStage]}`}
                                >
                                  <Play size={10} className="mr-1 text-hazard" />
                                  ADVANCE
                                </AdminButton>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </AdminCard>
        </div>

        {/* Selected Move Inspection Drawer */}
        {selectedMove && (
          <div className="lg:col-span-4">
            <AdminCard className="p-5 border-2 border-border space-y-4">
              <div className="flex items-start justify-between border-b border-border pb-3">
                <div>
                  <p className="mono text-[10px] text-muted-foreground font-semibold">MOVE DETAILS</p>
                  <h3 className="display text-xl font-bold mt-0.5">{selectedMove.reference}</h3>
                </div>
                <button
                  onClick={() => setSelectedMove(null)}
                  className="mono text-xs text-muted-foreground hover:text-foreground"
                >
                  &times; CLOSE
                </button>
              </div>

              <div className="space-y-2 mono text-xs">
                <div className="flex justify-between border-b border-border/50 py-1.5">
                  <span className="text-muted-foreground">CURRENT STATUS</span>
                  <AdminBadge variant={STAGE_BADGE_VARIANT[selectedMove.currentStage] ?? 'default'}>
                    {STAGE_LABELS[selectedMove.currentStage] ?? selectedMove.currentStage}
                  </AdminBadge>
                </div>

                <div className="flex justify-between border-b border-border/50 py-1.5">
                  <span className="text-muted-foreground">TOTAL REVENUE</span>
                  <span className="font-bold">{selectedMove.estimatedPrice} TND</span>
                </div>

                <div className="flex justify-between border-b border-border/50 py-1.5">
                  <span className="text-muted-foreground">PAYLOAD VOLUME</span>
                  <span>{selectedMove.volume} m&sup3;</span>
                </div>

                <div className="flex justify-between border-b border-border/50 py-1.5">
                  <span className="text-muted-foreground">DISTANCE</span>
                  <span>{selectedMove.distance} km</span>
                </div>
              </div>

              {/* Verified Load items */}
              {selectedMove.items && selectedMove.items.length > 0 && (
                <div>
                  <p className="mono text-[10px] font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                    <Package size={12} className="text-hazard" />
                    SCANNED LOAD MANIFEST ({selectedMove.items.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border border-border p-2 bg-muted/20 mono text-[11px]">
                    {selectedMove.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between border-b border-border/30 pb-1 last:border-0">
                        <span>{item.name} &times; {item.quantity}</span>
                        <span className="text-muted-foreground">{item.volume * item.quantity}m&sup3; &middot; {item.weight * item.quantity}kg</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Operator Advance Stage controller */}
              <div className="pt-2">
                <p className="mono text-[10px] font-bold text-muted-foreground uppercase mb-2">STAGE PIPELINE ADVANCE</p>
                <div className="grid grid-cols-2 gap-1.5 mono text-[10px]">
                  {STAGES_ORDER.map((stageKey) => {
                    const isCurrent = selectedMove.currentStage === stageKey;
                    return (
                      <button
                        key={stageKey}
                        onClick={() => handleAdvanceStage(selectedMove.id, stageKey)}
                        disabled={isPending}
                        className={`border p-2 text-left transition ${
                          isCurrent
                            ? 'border-hazard bg-hazard text-white font-bold'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        {STAGE_LABELS[stageKey]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <Link
                  href={`/track/${encodeURIComponent(selectedMove.reference)}`}
                  target="_blank"
                  className="mono flex items-center justify-center gap-2 border-2 border-foreground bg-foreground text-background py-2.5 text-xs font-bold hover:bg-hazard hover:border-hazard transition"
                >
                  <Truck size={14} /> VIEW LIVE GPS TELEMETRY &rarr;
                </Link>
              </div>
            </AdminCard>
          </div>
        )}
      </div>
    </div>
  );
}
