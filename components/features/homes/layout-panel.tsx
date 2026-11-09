'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  GripVertical,
  Loader2,
  MoveRight,
  RefreshCw,
  RotateCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/field';
import {
  useDeleteLayout,
  useGenerateLayout,
  useLayoutPlan,
  useUpdateLayoutItem,
} from '@/hooks/content/homes';
import { cn } from '@/lib/utils';
import {
  WALLS,
  type HomeDetailDto,
  type LayoutPlacementDto,
  type LayoutPlanDto,
  type LayoutProvider,
  type PlacementWall,
  type RoomDto,
} from '@/types/homes';
import { ConfirmDialog } from './confirm-dialog';
import { NativeSelect } from './form-controls';
import { FurnitureSymbol } from './furniture-symbol';
import { apiErrorMessage, WALL_LABELS } from './home-schemas';
import { RoomOutline } from './room-outline';
import { useLayoutDrag, type DragState, type DragTarget } from './use-layout-drag';

/** Drag feedback: green = free spot, red = not allowed (the only non-ink status colour). */
const FIT_GREEN = '#15803d';

const PROVIDER_LABELS: Record<LayoutProvider, string> = {
  ollama: 'Ollama (on this computer)',
  groq: 'Groq (cloud)',
};

const POSITIONS: PlacementWall[] = [...WALLS, 'CENTER'];

const wallLabel = (wall: PlacementWall) =>
  wall === 'CENTER' ? 'free-standing' : `${WALL_LABELS[wall].toLowerCase()} wall`;

const positionOption = (wall: PlacementWall) =>
  wall === 'CENTER' ? 'Free-standing' : `${WALL_LABELS[wall]} wall`;

type UnplacedUnit = LayoutPlanDto['unplaced'][number];

/** "Layout." — the AI suggests where every item goes; the client can adjust each one. */
export function LayoutPanel({ home }: { home: HomeDetailDto }) {
  const { data: plan, isLoading, isError, error, refetch } = useLayoutPlan(home.id, home.updatedAt);
  const generate = useGenerateLayout(home.id);
  const remove = useDeleteLayout(home.id);
  const [confirm, setConfirm] = useState<'delete' | 'regenerate' | null>(null);

  const missing = !home.moveRequest
    ? 'Link a move request above first: the assistant places its items.'
    : home.rooms.length === 0
      ? 'Add at least one room first: the assistant needs somewhere to put things.'
      : null;

  const run = () => {
    setConfirm(null);
    generate.mutate(undefined, {
      onSuccess: (result) =>
        toast.success(`Layout ready — planned by ${PROVIDER_LABELS[result.provider]}`),
    });
  };

  return (
    <section aria-labelledby="layout-title" className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-4">
        <div>
          <h2 id="layout-title" className="display text-3xl md:text-4xl">
            Layout.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-80">
            The assistant decides where each of your items goes (Ollama first, Groq if Ollama is
            unavailable). MoveUp draws every room to scale. Drag any item to a new spot — green
            means it fits, red means it does not (press R to turn it while dragging). Click an item
            for more options.
          </p>
        </div>
        {!missing && (
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => (plan && plan.manualChanges > 0 ? setConfirm('regenerate') : run())}
              disabled={generate.isPending}
            >
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
                onClick={() => setConfirm('delete')}
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
        <PlanView
          homeId={home.id}
          plan={plan}
          rooms={home.rooms}
          footprints={
            new Map(home.moveRequest?.items.map((item) => [item.id, item.footprint]) ?? [])
          }
        />
      ) : (
        !missing &&
        !generate.isPending && (
          <p className="mono mt-6 border border-dashed border-ink-40 px-4 py-5 text-[11px] text-ink-80">
            No layout yet. Press “Suggest layout” to place your {home.moveRequest?.totals.itemCount}{' '}
            item{home.moveRequest?.totals.itemCount === 1 ? '' : 's'} in your {home.rooms.length}{' '}
            room{home.rooms.length === 1 ? '' : 's'}.
          </p>
        )
      )}

      <ConfirmDialog
        open={confirm === 'regenerate'}
        title="Regenerate the layout?"
        description={`The assistant will make a new suggestion and replace your ${plan?.manualChanges ?? 0} manual change${plan?.manualChanges === 1 ? '' : 's'}.`}
        confirmLabel="Regenerate"
        onCancel={() => setConfirm(null)}
        onConfirm={run}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this layout?"
        description="The suggested positions will be removed. Your house, rooms and items stay as they are."
        confirmLabel="Delete plan"
        pending={remove.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              toast.success('Layout deleted');
              setConfirm(null);
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

function PlanView({
  homeId,
  plan,
  rooms,
  footprints,
}: {
  homeId: string;
  plan: LayoutPlanDto;
  rooms: RoomDto[];
  footprints: Map<string, { widthCm: number; depthCm: number }>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  // One running number per item across the whole house (drawing ↔ list).
  const numbered = rooms.flatMap((room) =>
    plan.placements.filter((placement) => placement.roomId === room.id),
  );
  const numberOf = new Map(numbered.map((placement, index) => [placement.unitId, index + 1]));
  const failed = plan.attempts.filter((attempt) => !attempt.ok);
  const used = plan.attempts.find((attempt) => attempt.ok);
  const toggle = (unitId: string) => setSelected((current) => (current === unitId ? null : unitId));
  const { drag, dropping, isClick, startFromPlacement, startFromList } = useLayoutDrag({
    homeId,
    plan,
    rooms,
  });
  const targetRoom = rooms.find((room) => room.id === drag?.target?.roomId);

  return (
    <div className="mt-6 space-y-8">
      {drag && (
        <p
          role="status"
          aria-live="polite"
          className="mono fixed bottom-4 left-1/2 z-50 w-[min(92vw,34rem)] -translate-x-1/2 border-2 bg-paper px-4 py-3 text-[11px] shadow-[4px_4px_0_var(--color-ink)]"
          style={{
            borderColor: !drag.target
              ? 'var(--color-ink)'
              : drag.target.problem
                ? 'var(--color-hazard)'
                : FIT_GREEN,
          }}
        >
          <span className="text-ink">{drag.name}</span>
          {!drag.target ? (
            <span className="text-ink-80"> — move over a room · Esc to cancel</span>
          ) : drag.target.problem ? (
            <span className="text-hazard">
              {' '}
              → {targetRoom?.name}: ✗ {drag.target.problem}
            </span>
          ) : (
            <span style={{ color: FIT_GREEN }}>
              {' '}
              → {targetRoom?.name}: ✓ free spot — release to place
            </span>
          )}
          <span className="block text-[10px] text-ink-40">R = turn · Esc = cancel</span>
        </p>
      )}
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
          {plan.manualChanges > 0 &&
            ` · ${plan.manualChanges} change${plan.manualChanges === 1 ? '' : 's'} by you`}
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
        {rooms.map((room) => (
          <RoomPlan
            key={room.id}
            homeId={homeId}
            room={room}
            rooms={rooms}
            placements={plan.placements.filter((placement) => placement.roomId === room.id)}
            numberOf={numberOf}
            selected={selected}
            onSelect={(unitId) => isClick() && toggle(unitId)}
            onClose={() => setSelected(null)}
            drag={drag}
            dropping={dropping}
            onDragStart={startFromPlacement}
          />
        ))}
      </ul>

      {plan.unplaced.length > 0 && (
        <div className="border border-hazard p-5">
          <h3 className="mono text-[11px] text-hazard">
            Not in the layout ({plan.unplaced.length})
          </h3>
          <ul className="mt-3 space-y-3 text-sm text-ink-80">
            {plan.unplaced.map((unit) => (
              <li key={unit.unitId}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {footprints.get(unit.itemId) ? (
                    <span
                      role="presentation"
                      title="Drag into a room drawing"
                      style={{ touchAction: 'none' }}
                      onPointerDown={(event) =>
                        startFromList(event, unit, footprints.get(unit.itemId)!)
                      }
                      onClick={() => isClick() && toggle(unit.unitId)}
                      className={cn(
                        'flex cursor-grab items-center gap-1 border border-dashed border-ink px-2 py-1 text-ink active:cursor-grabbing',
                        drag?.unitId === unit.unitId && 'opacity-40',
                      )}
                    >
                      <GripVertical className="size-3.5 text-ink-40" aria-hidden />
                      {unit.name}
                    </span>
                  ) : (
                    <span className="text-ink">{unit.name}</span>
                  )}
                  <span className="text-xs">— {unit.reason}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    aria-expanded={selected === unit.unitId}
                    onClick={() => toggle(unit.unitId)}
                  >
                    Place with menu
                  </Button>
                </div>
                {selected === unit.unitId && (
                  <ItemEditor
                    homeId={homeId}
                    rooms={rooms}
                    unit={unit}
                    onClose={() => setSelected(null)}
                  />
                )}
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
  homeId,
  room,
  rooms,
  placements,
  numberOf,
  selected,
  onSelect,
  onClose,
  drag,
  dropping,
  onDragStart,
}: {
  homeId: string;
  room: RoomDto;
  rooms: RoomDto[];
  placements: LayoutPlacementDto[];
  numberOf: Map<string, number>;
  selected: string | null;
  onSelect: (unitId: string) => void;
  onClose: () => void;
  drag: DragState | null;
  dropping: (DragTarget & { unitId: string }) | null;
  onDragStart: (event: React.PointerEvent<SVGGElement>, placement: LayoutPlacementDto) => void;
}) {
  const size = Math.max(room.widthCm, room.lengthCm);
  const stroke = size * 0.005;
  const editing = placements.find((placement) => placement.unitId === selected);
  const ghost =
    drag?.target?.roomId === room.id ? drag.target : dropping?.roomId === room.id ? dropping : null;
  const ghostColor = ghost ? (ghost.problem ? 'var(--color-hazard)' : FIT_GREEN) : undefined;

  return (
    <li
      className="border bg-paper p-5 transition-colors"
      style={{ borderColor: drag?.target?.roomId === room.id ? ghostColor : 'var(--color-ink)' }}
    >
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
          roomId={room.id}
        >
          {placements.map((placement) => {
            const label = String(numberOf.get(placement.unitId) ?? '');
            const isSelected = placement.unitId === selected;
            const isMoving =
              drag?.unitId === placement.unitId || dropping?.unitId === placement.unitId;
            const badge = Math.min(placement.w, placement.h, size * 0.12) * 0.3;
            const cx = placement.x + placement.w / 2;
            const cy = placement.y + placement.h / 2;
            return (
              <g
                key={placement.unitId}
                className="cursor-grab active:cursor-grabbing"
                style={{ touchAction: 'none' }}
                opacity={isMoving ? 0.3 : 1}
                onPointerDown={(event) => onDragStart(event, placement)}
                onClick={() => onSelect(placement.unitId)}
              >
                <title>{`${label}. ${placement.name} — drag to move, click to edit`}</title>
                <rect
                  x={placement.x}
                  y={placement.y}
                  width={placement.w}
                  height={placement.h}
                  fill={
                    isSelected
                      ? 'color-mix(in srgb, var(--color-hazard) 12%, var(--color-paper))'
                      : 'var(--color-paper)'
                  }
                  stroke={isSelected ? 'var(--color-hazard)' : 'var(--color-ink)'}
                  strokeWidth={isSelected ? stroke * 2 : stroke}
                />
                <FurnitureSymbol placement={placement} stroke={stroke} />
                <circle
                  cx={cx}
                  cy={cy}
                  r={badge}
                  fill={isSelected ? 'var(--color-hazard)' : 'var(--color-paper)'}
                  stroke={isSelected ? 'var(--color-hazard)' : 'var(--color-ink)'}
                  strokeWidth={stroke * 0.6}
                />
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={badge * 1.15}
                  className="mono"
                  fill={isSelected ? 'var(--color-paper)' : 'var(--color-ink)'}
                >
                  {label}
                </text>
              </g>
            );
          })}
          {ghost && (
            <g pointerEvents="none">
              <rect
                x={ghost.rect.x}
                y={ghost.rect.y}
                width={ghost.rect.w}
                height={ghost.rect.h}
                fill={`color-mix(in srgb, ${ghostColor} 28%, transparent)`}
                stroke={ghostColor}
                strokeWidth={stroke * 2.5}
                strokeDasharray={`${stroke * 6} ${stroke * 3}`}
              />
              <text
                x={ghost.rect.x + ghost.rect.w / 2}
                y={ghost.rect.y + ghost.rect.h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.min(ghost.rect.w, ghost.rect.h, size * 0.14) * 0.5}
                fill={ghostColor}
              >
                {ghost.problem ? '✗' : '✓'}
              </text>
            </g>
          )}
        </RoomOutline>
      </div>

      {editing && (
        <ItemEditor
          homeId={homeId}
          rooms={rooms}
          placement={editing}
          number={numberOf.get(editing.unitId)}
          unit={{ unitId: editing.unitId, name: editing.name, roomId: editing.roomId }}
          onClose={onClose}
        />
      )}

      {placements.length === 0 ? (
        <p className="mono mt-4 text-[10px] text-ink-40">Nothing placed in this room.</p>
      ) : (
        <ol className="mt-4 space-y-1">
          {placements.map((placement) => {
            const isSelected = placement.unitId === selected;
            return (
              <li key={placement.unitId}>
                <button
                  type="button"
                  aria-expanded={isSelected}
                  onClick={() => onSelect(placement.unitId)}
                  className={cn(
                    'flex w-full gap-3 p-1.5 text-left text-sm transition-colors hover:bg-paper-soft focus-visible:outline-2 focus-visible:outline-hazard',
                    isSelected && 'bg-hazard/5',
                  )}
                >
                  <span
                    className={cn(
                      'mono flex size-6 shrink-0 items-center justify-center border text-[10px]',
                      isSelected ? 'border-hazard bg-hazard text-white' : 'border-ink',
                    )}
                  >
                    {numberOf.get(placement.unitId)}
                  </span>
                  <span className="min-w-0">
                    <span className="text-ink">{placement.name}</span>
                    <span className="mono ml-2 text-[10px] text-ink-40">
                      {wallLabel(placement.wall)}
                      {placement.rotated ? ' · turned' : ''}
                    </span>
                    {placement.reason && (
                      <span className="block text-xs text-ink-80">{placement.reason}</span>
                    )}
                    {placement.source === 'client' && (
                      <span className="mono block text-[10px] text-hazard">Moved by you</span>
                    )}
                    {placement.requestedWall && (
                      <span className="mono block text-[10px] text-hazard">
                        No space on the {wallLabel(placement.requestedWall)} the assistant asked for
                        — moved here.
                      </span>
                    )}
                    {placement.source === 'moveup' && (
                      <span className="mono block text-[10px] text-hazard">
                        Room chosen by MoveUp (the assistant gave no usable room).
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </li>
  );
}

/** Move / turn / take out one item. Every save is re-checked by the server's packer. */
function ItemEditor({
  homeId,
  rooms,
  unit,
  placement,
  number,
  onClose,
}: {
  homeId: string;
  rooms: RoomDto[];
  unit: Pick<UnplacedUnit, 'unitId' | 'name' | 'roomId'>;
  placement?: LayoutPlacementDto;
  number?: number;
  onClose: () => void;
}) {
  const update = useUpdateLayoutItem(homeId);
  const [roomId, setRoomId] = useState(placement?.roomId ?? unit.roomId ?? rooms[0]?.id ?? '');
  const [wall, setWall] = useState<PlacementWall>(placement?.wall ?? 'N');
  const unchanged = placement && placement.roomId === roomId && placement.wall === wall;
  const roomName = rooms.find((room) => room.id === roomId)?.name ?? 'the room';

  const done = (message: string) => () => toast.success(message);

  return (
    <div
      role="group"
      aria-label={`Edit ${unit.name}`}
      onKeyDown={(event) => event.key === 'Escape' && onClose()}
      className="mt-4 space-y-4 border-2 border-hazard bg-paper p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="mono text-[10px] text-hazard">
          {placement ? `Edit ${number ? `${number}. ` : ''}${unit.name}` : `Place ${unit.name}`}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close editor"
          className="text-ink-40 hover:text-ink focus-visible:outline-2 focus-visible:outline-hazard"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`edit-room-${unit.unitId}`}>Room</Label>
          <NativeSelect
            id={`edit-room-${unit.unitId}`}
            value={roomId}
            onChange={(event) => {
              update.reset();
              setRoomId(event.target.value);
            }}
            className="h-10"
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor={`edit-wall-${unit.unitId}`}>Position</Label>
          <NativeSelect
            id={`edit-wall-${unit.unitId}`}
            value={wall}
            onChange={(event) => {
              update.reset();
              setWall(event.target.value as PlacementWall);
            }}
            className="h-10"
          >
            {POSITIONS.map((position) => (
              <option key={position} value={position}>
                {positionOption(position)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {update.isError && (
        <p
          role="alert"
          className="mono border border-hazard bg-hazard/5 px-3 py-2 text-[11px] text-hazard"
        >
          {apiErrorMessage(update.error)}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={update.isPending || unchanged || !roomId}
          onClick={() =>
            update.mutate(
              { action: 'move', unitId: unit.unitId, roomId, wall },
              { onSuccess: done(`${unit.name} → ${roomName}, ${wallLabel(wall)}`) },
            )
          }
        >
          {update.isPending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <MoveRight aria-hidden />
          )}
          {placement ? 'Move here' : 'Place here'}
        </Button>
        {placement && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={update.isPending}
              onClick={() =>
                update.mutate(
                  { action: 'rotate', unitId: unit.unitId },
                  { onSuccess: done(`${unit.name} turned 90°`) },
                )
              }
            >
              <RotateCw aria-hidden /> Turn 90°
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={update.isPending}
              onClick={() =>
                update.mutate(
                  { action: 'remove', unitId: unit.unitId },
                  {
                    onSuccess: () => {
                      toast.success(`${unit.name} taken out of the layout`);
                      onClose();
                    },
                  },
                )
              }
            >
              <Trash2 aria-hidden /> Take out
            </Button>
          </>
        )}
      </div>
      <p className="text-xs text-ink-80">
        MoveUp checks the new spot: inside the room, no overlap, doors and windows kept clear.
      </p>
    </div>
  );
}
