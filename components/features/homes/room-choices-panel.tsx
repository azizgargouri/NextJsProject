'use client';

import { useMemo } from 'react';
import { buildLayoutUnits, type LayoutUnit } from '@/lib/room-layout/units';
import { cn } from '@/lib/utils';
import { BOX_STACK, type MoveItemDto, type RoomDto } from '@/types/homes';
import { NativeSelect } from './form-controls';

/** unitId → roomId; a missing key means "the assistant decides". */
export type RoomChoices = Record<string, string>;

interface ChoiceRow {
  key: string;
  label: string;
  detail: string;
  /** Pieces this row sets (all stacks of boxes share one row). */
  unitIds: string[];
}

function rowsFor(items: MoveItemDto[]): ChoiceRow[] {
  const units = buildLayoutUnits(items, BOX_STACK);
  const byItem = new Map<string, LayoutUnit[]>();
  for (const unit of units) byItem.set(unit.itemId, [...(byItem.get(unit.itemId) ?? []), unit]);

  return items.flatMap((item) => {
    const itemUnits = byItem.get(item.id) ?? [];
    const size = `${item.footprint.widthCm} × ${item.footprint.depthCm} cm`;
    if (item.footprint.stackable) {
      return [
        {
          key: item.id,
          label: item.name,
          detail: `${item.quantity} in ${itemUnits.length} stack${itemUnits.length === 1 ? '' : 's'} of ${BOX_STACK}`,
          unitIds: itemUnits.map((unit) => unit.unitId),
        },
      ];
    }
    return itemUnits.map((unit) => ({
      key: unit.unitId,
      label: unit.name,
      detail: size,
      unitIds: [unit.unitId],
    }));
  });
}

/**
 * "Where does each piece go?" — the client may fix the room of any piece before
 * the assistant plans. Fixed pieces stay in that room; the assistant only picks
 * the wall. Anything left on "Assistant decides" is planned as before.
 */
export function RoomChoicesPanel({
  items,
  rooms,
  value,
  onChange,
  disabled,
}: {
  items: MoveItemDto[];
  rooms: RoomDto[];
  value: RoomChoices;
  onChange: (next: RoomChoices) => void;
  disabled?: boolean;
}) {
  const rows = useMemo(() => rowsFor(items), [items]);
  const totalPieces = rows.reduce((sum, row) => sum + row.unitIds.length, 0);
  const chosenPieces = rows.reduce(
    (sum, row) => sum + row.unitIds.filter((unitId) => value[unitId]).length,
    0,
  );

  const setRow = (row: ChoiceRow, roomId: string) => {
    const next = { ...value };
    for (const unitId of row.unitIds) {
      if (roomId) next[unitId] = roomId;
      else delete next[unitId];
    }
    onChange(next);
  };

  /** A row shows a room only when all of its pieces share it. */
  const rowValue = (row: ChoiceRow) => {
    const first = value[row.unitIds[0] ?? ''] ?? '';
    return row.unitIds.every((unitId) => (value[unitId] ?? '') === first) ? first : '';
  };

  return (
    <details open className="group mt-6 border border-ink">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-paper-soft">
        <span>
          <span className="mono block text-[11px] font-bold">Where does each piece go?</span>
          <span className="mt-0.5 block text-xs text-ink-80">
            Choose a room for any piece. The assistant keeps it there and only picks the wall;
            pieces left on “Assistant decides” are placed by the assistant.
          </span>
        </span>
        <span className="mono flex items-center gap-3 text-[11px] text-ink-80">
          <span className="tabular-nums">
            {chosenPieces} / {totalPieces} chosen
          </span>
          <span aria-hidden className="transition-transform group-open:rotate-180">
            ▾
          </span>
        </span>
      </summary>

      <div className="border-t border-ink">
        <ul className="divide-y divide-ink/15">
          {rows.map((row) => {
            const current = rowValue(row);
            const id = `room-choice-${row.key}`;
            return (
              <li
                key={row.key}
                className={cn(
                  'grid items-center gap-2 px-4 py-2.5 sm:grid-cols-[1fr_16rem] sm:gap-6',
                  current && 'bg-paper-soft',
                )}
              >
                <label htmlFor={id} className="min-w-0">
                  <span className="block truncate text-sm font-medium">{row.label}</span>
                  <span className="mono block text-[11px] text-ink-60">{row.detail}</span>
                </label>
                <NativeSelect
                  id={id}
                  value={current}
                  disabled={disabled}
                  onChange={(event) => setRow(row, event.target.value)}
                  className="h-10"
                >
                  <option value="">Assistant decides</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </NativeSelect>
              </li>
            );
          })}
        </ul>
        {chosenPieces > 0 && (
          <div className="flex justify-end border-t border-ink/15 px-4 py-2">
            <button
              type="button"
              onClick={() => onChange({})}
              disabled={disabled}
              className="mono text-[11px] text-ink-80 underline-offset-4 hover:text-hazard hover:underline disabled:opacity-50"
            >
              Clear all choices
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
