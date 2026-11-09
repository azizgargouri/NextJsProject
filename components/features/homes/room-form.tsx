'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError, FieldRow, Label } from '@/components/ui/field';
import {
  HOME_LIMITS,
  OPENING_KINDS,
  ROOM_TYPES,
  WALLS,
  type OpeningKind,
  type RoomPayload,
} from '@/types/homes';
import { NativeSelect, Textarea } from './form-controls';
import {
  apiErrorMessage,
  ROOM_TYPE_LABELS,
  RoomFormSchema,
  WALL_LABELS,
  type RoomFormValues,
} from './home-schemas';
import { openingSpot } from './layout-geometry';
import { RoomOutline } from './room-outline';

const EMPTY_ROOM: RoomFormValues = {
  name: '',
  type: 'BEDROOM',
  widthCm: 350,
  lengthCm: 300,
  notes: '',
  openings: [{ kind: 'DOOR', wall: 'S', offsetCm: 20, widthCm: 80 }],
};

interface RoomFormProps {
  defaultValues?: RoomFormValues;
  title: string;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (values: RoomPayload) => void;
  onCancel: () => void;
}

/** Room size + doors/windows editor with a live, to-scale preview. */
export function RoomForm({
  defaultValues = EMPTY_ROOM,
  title,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: RoomFormProps) {
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<RoomFormValues>({ resolver: zodResolver(RoomFormSchema), defaultValues });
  const { fields, append, remove } = useFieldArray({ control, name: 'openings' });
  const preview = useWatch({ control });

  const addOpening = (kind: OpeningKind) =>
    append({ kind, wall: 'N', offsetCm: 0, widthCm: kind === 'DOOR' ? 80 : 120 });

  // Drag a door/window on the preview: it follows the nearest wall, the fields follow it.
  const [draggedOpening, setDraggedOpening] = useState<number | null>(null);
  const stopDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => stopDrag.current?.(), []);

  const startOpeningDrag = (index: number, event: ReactPointerEvent<SVGLineElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    event.preventDefault();
    stopDrag.current?.();
    setDraggedOpening(index);

    const move = (pointer: PointerEvent) => {
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(pointer.clientX, pointer.clientY).matrixTransform(
        matrix.inverse(),
      );
      const { widthCm, lengthCm, openings } = getValues();
      const spot = openingSpot({ widthCm, lengthCm }, point, openings[index]?.widthCm ?? 0);
      if (!spot) return;
      setValue(`openings.${index}.wall`, spot.wall, { shouldDirty: true });
      setValue(`openings.${index}.offsetCm`, spot.offsetCm, {
        shouldDirty: true,
        shouldValidate: true,
      });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      stopDrag.current = null;
      setDraggedOpening(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    stopDrag.current = stop;
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label={title}
      className="grid gap-8 border-2 border-ink bg-paper p-5 md:p-8 lg:grid-cols-[minmax(0,1fr)_320px]"
    >
      <div className="min-w-0 space-y-6">
        <p className="mono text-[10px] text-hazard">{title}</p>

        <div className="grid gap-6 sm:grid-cols-2">
          <FieldRow>
            <Label htmlFor="room-name">Room name</Label>
            <Input
              id="room-name"
              placeholder="Master bedroom"
              aria-invalid={Boolean(errors.name)}
              {...register('name')}
            />
            <FieldError message={errors.name?.message} />
          </FieldRow>

          <FieldRow>
            <Label htmlFor="room-type">Type</Label>
            <NativeSelect id="room-type" {...register('type')}>
              {ROOM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ROOM_TYPE_LABELS[type]}
                </option>
              ))}
            </NativeSelect>
          </FieldRow>

          <FieldRow>
            <Label htmlFor="room-width">Width, west → east (cm)</Label>
            <Input
              id="room-width"
              type="number"
              inputMode="numeric"
              aria-invalid={Boolean(errors.widthCm)}
              {...register('widthCm', { valueAsNumber: true })}
            />
            <FieldError message={errors.widthCm?.message} />
          </FieldRow>

          <FieldRow>
            <Label htmlFor="room-length">Length, north → south (cm)</Label>
            <Input
              id="room-length"
              type="number"
              inputMode="numeric"
              aria-invalid={Boolean(errors.lengthCm)}
              {...register('lengthCm', { valueAsNumber: true })}
            />
            <FieldError message={errors.lengthCm?.message} />
          </FieldRow>
        </div>

        <fieldset className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <legend className="mono text-[10px] text-ink-80">
              Doors &amp; windows ({fields.length}/{HOME_LIMITS.openingsPerRoom})
            </legend>
            <div className="flex gap-2">
              {OPENING_KINDS.map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={fields.length >= HOME_LIMITS.openingsPerRoom}
                  onClick={() => addOpening(kind)}
                >
                  <Plus aria-hidden /> {kind === 'DOOR' ? 'Door' : 'Window'}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-xs text-ink-80">
            Drag a door or window along the walls in the preview to place it, or type it below.
            Offset = distance from the wall&apos;s start corner: the west corner for north/south
            walls, the north corner for east/west walls.
          </p>

          {fields.length === 0 && (
            <p className="mono border border-dashed border-ink-40 px-3 py-4 text-[10px] text-ink-40">
              No openings yet — add at least the entrance door.
            </p>
          )}

          <ul className="space-y-3">
            {fields.map((field, index) => {
              const rowErrors = errors.openings?.[index];
              return (
                <li key={field.id} className="border border-ink p-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end">
                    <FieldRow>
                      <Label htmlFor={`opening-${index}-kind`}>Kind</Label>
                      <NativeSelect
                        id={`opening-${index}-kind`}
                        {...register(`openings.${index}.kind`)}
                      >
                        {OPENING_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {kind === 'DOOR' ? 'Door' : 'Window'}
                          </option>
                        ))}
                      </NativeSelect>
                    </FieldRow>
                    <FieldRow>
                      <Label htmlFor={`opening-${index}-wall`}>Wall</Label>
                      <NativeSelect
                        id={`opening-${index}-wall`}
                        {...register(`openings.${index}.wall`)}
                      >
                        {WALLS.map((wall) => (
                          <option key={wall} value={wall}>
                            {WALL_LABELS[wall]}
                          </option>
                        ))}
                      </NativeSelect>
                    </FieldRow>
                    <FieldRow>
                      <Label htmlFor={`opening-${index}-offset`}>Offset cm</Label>
                      <Input
                        id={`opening-${index}-offset`}
                        type="number"
                        inputMode="numeric"
                        aria-invalid={Boolean(rowErrors?.offsetCm)}
                        {...register(`openings.${index}.offsetCm`, { valueAsNumber: true })}
                      />
                    </FieldRow>
                    <FieldRow>
                      <Label htmlFor={`opening-${index}-width`}>Width cm</Label>
                      <Input
                        id={`opening-${index}-width`}
                        type="number"
                        inputMode="numeric"
                        aria-invalid={Boolean(rowErrors?.widthCm)}
                        {...register(`openings.${index}.widthCm`, { valueAsNumber: true })}
                      />
                    </FieldRow>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="col-span-2 w-full sm:col-span-1 sm:w-10"
                      aria-label={`Remove opening ${index + 1}`}
                      onClick={() => remove(index)}
                    >
                      <X aria-hidden />
                    </Button>
                  </div>
                  <FieldError
                    message={rowErrors?.offsetCm?.message ?? rowErrors?.widthCm?.message}
                  />
                </li>
              );
            })}
          </ul>
        </fieldset>

        <FieldRow>
          <Label htmlFor="room-notes">Notes (optional)</Label>
          <Textarea
            id="room-notes"
            placeholder="Radiator under the window, built-in closet on the east wall…"
            aria-invalid={Boolean(errors.notes)}
            {...register('notes')}
          />
          <FieldError message={errors.notes?.message} />
        </FieldRow>
      </div>

      <aside className="space-y-3">
        <p className="mono text-[10px] text-ink-80">Preview (to scale)</p>
        <div className="aspect-square border border-ink bg-paper p-2">
          <RoomOutline
            widthCm={preview.widthCm ?? 0}
            lengthCm={preview.lengthCm ?? 0}
            openings={(preview.openings ?? []).filter(
              (opening): opening is RoomFormValues['openings'][number] =>
                Boolean(opening?.kind && opening.wall),
            )}
            label="Preview of the room outline"
            onOpeningPointerDown={startOpeningDrag}
            activeOpening={draggedOpening}
          />
        </div>
        <ul className="mono space-y-1 text-[10px] text-ink-80">
          <li className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-5 bg-hazard" aria-hidden /> Door + swing
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-5 border-y border-ink" aria-hidden /> Window
          </li>
          <li>Drag them along the walls to move them.</li>
        </ul>
      </aside>

      {Boolean(error) && (
        <p
          role="alert"
          className="mono border border-hazard bg-hazard/5 px-3 py-2 text-[11px] text-hazard lg:col-span-2"
        >
          {apiErrorMessage(error)}
        </p>
      )}

      <div className="flex flex-wrap gap-3 lg:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-label="Saving" /> : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
