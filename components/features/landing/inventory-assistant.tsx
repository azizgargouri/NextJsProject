'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ImagePlus, Minus, Plus, X } from 'lucide-react';
import { fill, type LandingLocale, type LandingMessages } from '@/lib/i18n/landing';
import {
  inventoryTotal,
  type InventoryLine,
  type InventoryResult,
} from '@/lib/inventory/catalogue';
import { cn } from '@/lib/utils';

const MAX_PHOTOS = 3;
const MAX_EDGE = 1280;

type Copy = LandingMessages['estimate']['ai'];
type Status =
  | { kind: 'idle' }
  | { kind: 'working'; startedAt: number }
  | { kind: 'done'; model: string; note: string | null }
  | { kind: 'error'; message: string };

interface Photo {
  id: string;
  file: Blob;
  url: string;
}

/** Downscales a photo in the browser so the local model reads it quickly. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * Inventory assistant. Plain words and photos go to a local model, which only
 * names and counts items; volumes come from the shared reference catalogue.
 * The customer edits the list, then applies the total to the estimator.
 */
export function InventoryAssistant({
  t,
  locale,
  onApply,
}: {
  t: Copy;
  locale: LandingLocale;
  onApply: (m3: number) => void;
}) {
  const descriptionId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [lines, setLines] = useState<InventoryLine[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [applied, setApplied] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const volume = useMemo(
    () => new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 1 }),
    [locale],
  );
  const total = inventoryTotal(lines);

  useEffect(() => {
    if (status.kind !== 'working') return;
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - status.startedAt) / 1000)),
      500,
    );
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => () => photos.forEach((photo) => URL.revokeObjectURL(photo.url)), [photos]);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const picked = await Promise.all(
      Array.from(files)
        .slice(0, room)
        .map(async (file) => {
          const blob = await shrink(file);
          return { id: crypto.randomUUID(), file: blob, url: URL.createObjectURL(blob) };
        }),
    );
    setPhotos((current) => [...current, ...picked].slice(0, MAX_PHOTOS));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removePhoto(id: string) {
    setPhotos((current) => current.filter((photo) => photo.id !== id));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!description.trim() && photos.length === 0) {
      setStatus({ kind: 'error', message: t.errors.invalid });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setElapsed(0);
    setApplied(null);
    setStatus({ kind: 'working', startedAt: Date.now() });

    const form = new FormData();
    form.set('description', description.trim());
    form.set('locale', locale);
    photos.forEach((photo, index) => form.append('photos', photo.file, `photo-${index + 1}.jpg`));

    try {
      const response = await fetch('/api/estimate/inventory', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        const message =
          response.status === 503
            ? t.errors.offline
            : response.status === 429
              ? fill(t.errors.busy, { s: response.headers.get('Retry-After') ?? '60' })
              : response.status === 413
                ? t.errors.tooLarge
                : response.status === 422 && body?.message?.includes('PNG')
                  ? t.errors.photoType
                  : response.status === 422
                    ? t.errors.invalid
                    : t.errors.generic;
        setStatus({ kind: 'error', message });
        return;
      }
      const result = (await response.json()) as InventoryResult;
      setLines(result.lines);
      setStatus({ kind: 'done', model: result.model, note: result.note });
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus({ kind: 'idle' });
        return;
      }
      setStatus({ kind: 'error', message: t.errors.offline });
    } finally {
      abortRef.current = null;
    }
  }

  function changeQuantity(index: number, delta: number) {
    setApplied(null);
    setLines((current) =>
      current.map((line, i) =>
        i === index
          ? { ...line, quantity: Math.max(1, Math.min(100, line.quantity + delta)) }
          : line,
      ),
    );
  }

  function removeLine(index: number) {
    setApplied(null);
    setLines((current) => current.filter((_, i) => i !== index));
  }

  function restart() {
    setLines([]);
    setApplied(null);
    setStatus({ kind: 'idle' });
  }

  function apply() {
    onApply(total);
    setApplied(total);
  }

  const working = status.kind === 'working';
  const showResult = status.kind === 'done';

  return (
    <div className="border-2 border-ink bg-paper">
      <div className="flex items-start justify-between gap-4 border-b border-ink px-5 py-4">
        <div>
          <p className="mono text-[11px] text-hazard-ink">{t.kicker}</p>
          <p className="display mt-1 text-2xl">{t.title}</p>
        </div>
        <span className="mono shrink-0 border border-ink px-2 py-1 text-[11px]">{t.badge}</span>
      </div>

      {!showResult ? (
        <form onSubmit={submit} className="space-y-5 px-5 py-5" aria-busy={working}>
          <p className="text-sm leading-relaxed text-ink-80">{t.intro}</p>

          <div>
            <label htmlFor={descriptionId} className="mono text-[11px] text-ink-80">
              {t.descriptionLabel}
            </label>
            <textarea
              id={descriptionId}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              rows={4}
              disabled={working}
              placeholder={t.placeholder}
              className="mt-2 block w-full resize-y border-2 border-ink bg-paper-soft px-3 py-2.5 text-sm leading-relaxed text-ink outline-none placeholder:text-ink-60 focus-visible:border-hazard disabled:opacity-60"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <p className="mono text-[11px] text-ink-80">{t.photos}</p>
              <p className="mono text-[11px] text-ink-60">{t.photoHint}</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.map((photo, index) => (
                <div key={photo.id} className="relative size-20 border-2 border-ink">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  <img src={photo.url} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    disabled={working}
                    aria-label={fill(t.removePhoto, { n: index + 1 })}
                    className="absolute -right-2 -top-2 grid size-6 place-items-center border-2 border-ink bg-paper hover:bg-hazard hover:text-white"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={working}
                  className="mono flex size-20 flex-col items-center justify-center gap-1.5 border-2 border-dashed border-ink/50 text-[11px] text-ink-80 transition-colors hover:border-ink hover:text-ink disabled:opacity-60"
                >
                  <ImagePlus className="size-4" aria-hidden />
                  <span aria-hidden>{t.addShort}</span>
                  <span className="sr-only">{t.addPhotos}</span>
                </button>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                hidden
                onChange={(event) => void addPhotos(event.target.files)}
              />
            </div>
          </div>

          {working ? (
            <div role="status" className="border border-ink bg-paper-soft px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <p className="mono text-[11px] font-bold">{t.working}</p>
                <p className="mono text-[11px] tabular-nums text-ink-60">
                  {fill(t.elapsed, { s: elapsed })}
                </p>
              </div>
              <div aria-hidden className="relative mt-3 h-1 overflow-hidden bg-ink/15">
                <span className="inventory-scan absolute inset-y-0 w-1/3 bg-hazard" />
              </div>
              <p className="mt-2 text-xs text-ink-80">{t.workingHint}</p>
            </div>
          ) : null}

          {status.kind === 'error' ? (
            <p role="alert" className="border-l-4 border-hazard pl-3 text-sm text-hazard-ink">
              {status.message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={working}
              className="mono inline-flex h-12 items-center justify-center bg-ink px-6 text-xs text-paper transition-colors duration-200 hover:bg-hazard disabled:opacity-60"
            >
              {t.submit}
            </button>
            {working ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="mono inline-flex h-12 items-center border-b-2 border-ink px-2 text-xs hover:border-hazard hover:text-hazard-ink"
              >
                {t.cancel}
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <div ref={resultRef} tabIndex={-1} className="px-5 py-5 outline-none">
          <div className="flex items-baseline justify-between gap-4">
            <p className="mono text-[11px] font-bold">{t.resultTitle}</p>
            <p className="mono text-[11px] text-ink-60">{fill(t.count, { n: lines.length })}</p>
          </div>

          {lines.length === 0 ? (
            <p className="mt-4 text-sm text-ink-80">{t.empty}</p>
          ) : (
            <ul className="mono mt-3 divide-y divide-ink/15 border-y border-ink text-xs">
              {lines.map((line, index) => (
                <li key={`${line.key}-${line.label}`} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{line.label}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-60">
                      <span className="tabular-nums">
                        {volume.format(line.unitM3)} m³ × {line.quantity}
                      </span>
                      {line.assumed ? (
                        <span className="border border-ink/40 px-1 text-ink-80">{t.assumed}</span>
                      ) : null}
                      {line.estimated ? (
                        <span className="border border-hazard-ink/60 px-1 text-hazard-ink">
                          {t.estimated}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Stepper
                      label={fill(t.decrease, { item: line.label })}
                      disabled={line.quantity <= 1}
                      onClick={() => changeQuantity(index, -1)}
                    >
                      <Minus className="size-3" />
                    </Stepper>
                    <span className="w-7 text-center tabular-nums">{line.quantity}</span>
                    <Stepper
                      label={fill(t.increase, { item: line.label })}
                      onClick={() => changeQuantity(index, 1)}
                    >
                      <Plus className="size-3" />
                    </Stepper>
                  </div>
                  <span className="w-12 shrink-0 text-right font-bold tabular-nums">
                    {volume.format(line.quantity * line.unitM3)}
                  </span>
                  <Stepper
                    label={fill(t.remove, { item: line.label })}
                    onClick={() => removeLine(index)}
                  >
                    <X className="size-3" />
                  </Stepper>
                </li>
              ))}
            </ul>
          )}

          {lines.some((line) => line.assumed || line.estimated) ? (
            <p className="mt-3 text-[11px] leading-relaxed text-ink-60">{t.legend}</p>
          ) : null}
          {status.note ? <p className="mt-2 text-xs text-ink-80">{status.note}</p> : null}

          <div className="mt-4 flex items-baseline justify-between gap-4 border-t-2 border-ink pt-3">
            <p className="mono text-[11px]">{t.total}</p>
            <p className="display text-3xl tabular-nums">
              {volume.format(total)}
              <span className="mono ml-1.5 text-sm font-normal tracking-normal">m³</span>
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={apply}
              disabled={total <= 0}
              className="mono inline-flex h-12 items-center justify-center bg-hazard px-6 text-xs text-white transition-colors duration-200 hover:bg-ink disabled:opacity-50"
            >
              {fill(t.apply, { m3: volume.format(total) })}
            </button>
            <button
              type="button"
              onClick={restart}
              className="mono inline-flex h-12 items-center border-b-2 border-ink px-2 text-xs hover:border-hazard hover:text-hazard-ink"
            >
              {t.restart}
            </button>
          </div>
          <p aria-live="polite" className="mt-3 text-xs text-ink-80">
            {applied !== null ? fill(t.applied, { m3: volume.format(applied) }) : ''}
          </p>
          <p className="mono mt-3 text-[11px] text-ink-60">
            {fill(t.model, { name: status.model.toUpperCase() })}
          </p>
        </div>
      )}
    </div>
  );
}

function Stepper({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'grid size-8 place-items-center border border-transparent transition-colors',
        'hover:border-ink disabled:opacity-30 disabled:hover:border-transparent',
      )}
    >
      {children}
    </button>
  );
}
