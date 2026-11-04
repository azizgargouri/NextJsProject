'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDeleteLayout, useGenerateLayout, useLayoutPlan } from '@/hooks/content/homes';
import type {
  HomeDetailDto,
  LayoutPlacementDto,
  LayoutPlanDto,
  LayoutProvider,
  RoomDto,
} from '@/types/homes';
import { ConfirmDialog } from './confirm-dialog';
import { apiErrorMessage, WALL_LABELS } from './home-schemas';
import { RoomOutline } from './room-outline';

const PROVIDER_LABELS: Record<LayoutProvider, string> = {
  ollama: 'Ollama (on this computer)',
  groq: 'Groq (cloud)',
};

const wallLabel = (wall: LayoutPlacementDto['wall']) =>
  wall === 'CENTER' ? 'free-standing' : `${WALL_LABELS[wall].toLowerCase()} wall`;

/** "Layout." — ask the AI where every item goes, then draw each room to scale. */
export function LayoutPanel({ home }: { home: HomeDetailDto }) {
  const { data: plan, isLoading, isError, error, refetch } = useLayoutPlan(home.id, home.updatedAt);
  const generate = useGenerateLayout(home.id);
  const remove = useDeleteLayout(home.id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const missing = !home.moveRequest
    ? 'Link a move request above first: the assistant places its items.'
    : home.rooms.length === 0
      ? 'Add at least one room first: the assistant needs somewhere to put things.'
      : null;

  const run = () =>
    generate.mutate(undefined, {
      onSuccess: (result) =>
        toast.success(`Layout ready — planned by ${PROVIDER_LABELS[result.provider]}`),
    });

  return (
    <section aria-labelledby="layout-title" className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-4">
        <div>
          <h2 id="layout-title" className="display text-3xl md:text-4xl">
            Layout.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-80">
            The assistant decides where each of your items goes (Ollama first, Groq if Ollama is
            unavailable). MoveUp then draws every room to scale so nothing overlaps or blocks a
            door.
          </p>
        </div>
        {!missing && (
          <div className="flex flex-wrap gap-3">
            <Button onClick={run} disabled={generate.isPending}>
              {generate.isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : plan ? (
                <RefreshCw aria-hidden />
              ) : (
                <Sparkles aria-hidden />
              )}
              {plan ? 'Regenerate' : 'Suggest layout'}
            </Button>
            {plan && (
              <Button
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                disabled={generate.isPending}
              >
                <Trash2 aria-hidden /> Delete plan
              </Button>
            )}
          </div>
        )}
      </div>

      {missing && (
        <p className="mono mt-6 border border-dashed border-ink-40 px-4 py-5 text-[11px] text-ink-80">
          {missing}
        </p>
      )}

      {generate.isPending && <Generating />}

      {generate.isError && !generate.isPending && (
        <p
          role="alert"
          className="mono mt-6 border border-hazard bg-hazard/5 px-3 py-2 text-[11px] text-hazard"
        >
          {apiErrorMessage(generate.error, 'The layout could not be generated. Try again.')}
        </p>
      )}

      {isLoading ? (
        <div
          className="mt-6 h-40 animate-pulse bg-paper-soft motion-reduce:animate-none"
          aria-busy
        />
      ) : isError ? (
        <div role="alert" className="mt-6 border border-hazard bg-hazard/5 p-4">
          <p className="mono text-[11px] text-hazard">
            {apiErrorMessage(error, 'Could not load the saved layout.')}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : plan ? (
        <PlanView plan={plan} rooms={home.rooms} />
      ) : (
        !missing &&
        !generate.isPending && (
          <p className="mono mt-6 border border-dashed border-ink-40 px-4 py-5 text-[11px] text-ink-80">
            No layout yet. Press “Suggest layout” to place your {home.moveRequest?.totals.itemCount}{' '}
            items in your {home.rooms.length} room{home.rooms.length === 1 ? '' : 's'}.
          </p>
        )
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this layout?"
        description="The suggested positions will be removed. Your house, rooms and items stay as they are."
        confirmLabel="Delete plan"
        pending={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              toast.success('Layout deleted');
              setConfirmDelete(false);
            },
            onError: (deleteError) => toast.error(apiErrorMessage(deleteError)),
          })
        }
      />
    </section>
  );
}

function Generating() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div role="status" className="mt-6 flex items-center gap-4 border-2 border-ink p-5">
      <Loader2 className="size-6 shrink-0 animate-spin text-hazard" aria-hidden />
      <div>
        <p className="mono text-[11px] text-ink">Planning your rooms… {seconds}s</p>
        <p className="mt-1 text-xs text-ink-80">
          Asking Ollama first; if it does not answer, Groq takes over. This can take up to a minute.
        </p>
      </div>
    </div>
  );
}

function PlanView({ plan, rooms }: { plan: LayoutPlanDto; rooms: RoomDto[] }) {
  // One running number per item across the whole house (drawing ↔ list).
  const numbered = rooms.flatMap((room) =>
    plan.placements.filter((placement) => placement.roomId === room.id),
  );
  const numberOf = new Map(numbered.map((placement, index) => [placement.unitId, index + 1]));
  const failed = plan.attempts.filter((attempt) => !attempt.ok);
  const used = plan.attempts.find((attempt) => attempt.ok);

  return (
    <div className="mt-6 space-y-8">
      <div className="space-y-2">
        <p className="mono text-[11px] text-ink-80">
          Planned by <span className="text-hazard">{PROVIDER_LABELS[plan.provider]}</span> ·{' '}
          {plan.model}
          {used ? ` · ${(used.ms / 1000).toFixed(1)} s` : ''} ·{' '}
          {new Date(plan.createdAt).toLocaleString('en-GB', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}{' '}
          · {plan.moveReference}
        </p>
        {failed.map((attempt) => (
          <p key={attempt.provider} className="mono text-[10px] text-ink-40">
            {attempt.provider === 'ollama' ? 'Ollama' : 'Groq'} skipped: {attempt.error}
          </p>
        ))}
      </div>

      {plan.stale && (
        <p
          role="status"
          className="mono flex items-center gap-2 border border-hazard bg-hazard/5 px-3 py-2 text-[11px] text-hazard"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Your rooms or items changed after this plan was made. Regenerate to update it.
        </p>
      )}

      <ul className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {rooms.map((room) => {
          const inRoom = plan.placements.filter((placement) => placement.roomId === room.id);
          return <RoomPlan key={room.id} room={room} placements={inRoom} numberOf={numberOf} />;
        })}
      </ul>

      {plan.unplaced.length > 0 && (
        <div className="border border-hazard p-5">
          <h3 className="mono text-[11px] text-hazard">
            Could not be placed ({plan.unplaced.length})
          </h3>
          <ul className="mt-3 space-y-1 text-sm text-ink-80">
            {plan.unplaced.map((unit) => (
              <li key={unit.unitId}>
                <span className="text-ink">{unit.name}</span> — {unit.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.warnings.length > 0 && (
        <ul className="space-y-1 text-xs text-ink-80">
          {plan.warnings.map((warning, index) => (
            <li key={index}>⚠ {warning}</li>
          ))}
        </ul>
      )}

      {plan.tips.length > 0 && (
        <div className="border-t border-ink pt-5">
          <h3 className="mono text-[10px] text-ink-40">Move-in tips</h3>
          <ul className="mt-3 grid gap-3 text-sm text-ink-80 md:grid-cols-2">
            {plan.tips.map((tip, index) => (
              <li key={index} className="flex gap-2">
                <span className="text-hazard" aria-hidden>
                  ›
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RoomPlan({
  room,
  placements,
  numberOf,
}: {
  room: RoomDto;
  placements: LayoutPlacementDto[];
  numberOf: Map<string, number>;
}) {
  const size = Math.max(room.widthCm, room.lengthCm);
  const stroke = size * 0.005;

  return (
    <li className="border border-ink bg-paper p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="display text-2xl">{room.name}</h3>
        <p className="mono shrink-0 text-[10px] text-ink-40">
          {placements.length} item{placements.length === 1 ? '' : 's'}
        </p>
      </div>
      <div className="mt-4 aspect-[4/3] border border-ink/20 p-2">
        <RoomOutline
          widthCm={room.widthCm}
          lengthCm={room.lengthCm}
          openings={room.openings}
          label={`${room.name} layout: ${placements.map((p) => p.name).join(', ') || 'empty'}`}
        >
          {placements.map((placement) => {
            const label = String(numberOf.get(placement.unitId) ?? '');
            const fontSize = Math.min(placement.w, placement.h, size * 0.12) * 0.5;
            return (
              <g key={placement.unitId}>
                <title>{`${label}. ${placement.name}`}</title>
                <rect
                  x={placement.x}
                  y={placement.y}
                  width={placement.w}
                  height={placement.h}
                  fill="var(--color-paper)"
                  stroke="var(--color-ink)"
                  strokeWidth={stroke}
                />
                <text
                  x={placement.x + placement.w / 2}
                  y={placement.y + placement.h / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={fontSize}
                  className="mono"
                  fill="var(--color-ink)"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </RoomOutline>
      </div>
      {placements.length === 0 ? (
        <p className="mono mt-4 text-[10px] text-ink-40">Nothing placed in this room.</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {placements.map((placement) => (
            <li key={placement.unitId} className="flex gap-3 text-sm">
              <span className="mono flex size-6 shrink-0 items-center justify-center border border-ink text-[10px]">
                {numberOf.get(placement.unitId)}
              </span>
              <span className="min-w-0">
                <span className="text-ink">{placement.name}</span>
                <span className="mono ml-2 text-[10px] text-ink-40">
                  {wallLabel(placement.wall)}
                </span>
                {placement.reason && (
                  <span className="block text-xs text-ink-80">{placement.reason}</span>
                )}
                {placement.requestedWall && (
                  <span className="mono block text-[10px] text-hazard">
                    No space on the {wallLabel(placement.requestedWall)} the assistant asked for —
                    moved here.
                  </span>
                )}
                {placement.source === 'moveup' && (
                  <span className="mono block text-[10px] text-hazard">
                    Room chosen by MoveUp (the assistant gave no usable room).
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}
