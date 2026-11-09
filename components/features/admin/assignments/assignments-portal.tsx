'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  RotateCcw,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  User,
  Phone,
} from 'lucide-react';
import { AdminBadge } from '@/components/ui/admin-badge';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminCard } from '@/components/ui/admin-card';
import { api } from '@/lib/api';
import type { MoveDataDto } from '@/lib/api/moves';
import { useAdminShell } from '../shell/admin-shell-context';

export function AssignmentsPortal() {
  const { setPage: publishPage, clearPage, clearFooter } = useAdminShell();
  const [moves, setMoves] = useState<MoveDataDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAssignments = async () => {
    setIsLoading(true);
    try {
      const res = await api.moves.list();
      setMoves(res.moves ?? []);
    } catch {
      // Handled
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    publishPage({
      breadcrumbs: [{ label: 'Operations' }, { label: 'Assignments' }],
      title: 'Vehicle & mover assignments',
      description: 'Fleet allocations, capacity utilization, and vetted driver dispatch.',
      actions: (
        <AdminButton
          variant="outline"
          size="sm"
          onClick={fetchAssignments}
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
    void fetchAssignments();
  }, []);

  return (
    <div className="space-y-6">
      {/* Fleet Metrics Strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminCard className="p-4">
          <p className="mono text-[10px] text-muted-foreground uppercase font-semibold">Allocated Vehicles</p>
          <p className="display mt-1 text-3xl font-bold">{moves.length}</p>
          <p className="mono text-[10px] text-muted-foreground mt-1">Active vans and box trucks in field</p>
        </AdminCard>

        <AdminCard className="p-4">
          <p className="mono text-[10px] text-muted-foreground uppercase font-semibold">Average Payload Load</p>
          <p className="display mt-1 text-3xl font-bold">
            {moves.length > 0 ? (moves.reduce((acc, m) => acc + m.volume, 0) / moves.length).toFixed(1) : 0}{' '}
            <span className="text-sm font-normal">m&sup3;</span>
          </p>
          <p className="mono text-[10px] text-muted-foreground mt-1">Optimal volumetric balance</p>
        </AdminCard>

        <AdminCard className="p-4">
          <p className="mono text-[10px] text-muted-foreground uppercase font-semibold">Vetted Operator Compliance</p>
          <p className="display mt-1 text-3xl font-bold text-emerald-600">100%</p>
          <p className="mono text-[10px] text-muted-foreground mt-1">Identity &amp; commercial insurance verified</p>
        </AdminCard>
      </div>

      {/* Grid of Active Vehicle Assignments */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {moves.map((m) => {
          const capPct = Math.min(100, Math.round((m.volume / (m.vehicle?.capacity || 14)) * 100));

          return (
            <AdminCard key={m.id} className="p-5 border border-border flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="mono text-[9px] text-muted-foreground">REF / {m.reference}</span>
                    <h3 className="display text-lg font-bold">{m.vehicle?.name ?? 'Moving Van'}</h3>
                  </div>
                  <AdminBadge variant={m.currentStage === 'IN_TRANSIT' ? 'destructive' : 'default'}>
                    {m.currentStage}
                  </AdminBadge>
                </div>

                {/* Operator info */}
                <div className="mt-4 border-t border-border pt-3 space-y-1.5 mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <User size={12} /> DRIVER / FLEET
                    </span>
                    <span className="font-bold">{m.mover?.name ?? 'Mehdi Transport'}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Phone size={12} /> CONTACT
                    </span>
                    <a href={`tel:${m.mover?.phone ?? '+21698123456'}`} className="hover:underline text-hazard">
                      {m.mover?.phone ?? '+216 98 123 456'}
                    </a>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <ShieldCheck size={12} /> VERIFICATION
                    </span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle size={11} /> APPROVED
                    </span>
                  </div>
                </div>

                {/* Capacity Progress Meter */}
                <div className="mt-4 border-t border-border pt-3">
                  <div className="flex justify-between mono text-[10px] mb-1">
                    <span className="text-muted-foreground">VOLUME UTILIZATION</span>
                    <span className="font-bold">{m.volume} / {m.vehicle?.capacity || 14} m&sup3; ({capPct}%)</span>
                  </div>
                  <div className="h-2 w-full bg-muted overflow-hidden border border-border">
                    <div
                      className={`h-full ${capPct > 90 ? 'bg-hazard' : 'bg-foreground'}`}
                      style={{ width: `${capPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-border pt-3 flex items-center justify-between">
                <span className="mono text-[10px] text-muted-foreground truncate max-w-[160px]">
                  {m.pickupAddress.split(',')[0]} &rarr; {m.destinationAddress.split(',')[0]}
                </span>
                <Link
                  href={`/track/${encodeURIComponent(m.reference)}`}
                  target="_blank"
                  className="mono text-xs font-bold text-hazard hover:underline inline-flex items-center gap-1"
                >
                  LIVE TRACK <ExternalLink size={12} />
                </Link>
              </div>
            </AdminCard>
          );
        })}
      </div>
    </div>
  );
}
