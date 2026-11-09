'use client';

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Loader2,
  Maximize2,
  RotateCcw,
  Sparkles,
  Trash2,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/field';
import { createClaimAction } from '@/app/(dashboard)/dashboard/actions';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { initialActionState } from '@/lib/actions/action-state';
import {
  CLAIM_CATEGORIES,
  CLAIM_CATEGORY_LABELS,
  DAMAGE_SEVERITY_LABELS,
  type ClaimCategory,
  type DamageSeverity,
} from '@/lib/quality/constants';
import type { AnalysisSource, DamageVision } from '@/types';
import { FormMessage, NativeSelect, SubmitButton, Textarea } from './workspace-ui';

export interface CompletedMoveOption {
  moveReference: string;
  route: string;
  completedDate: string;
  truckTier: string;
  moverId: string;
  moverName: string;
  totalPaidTnd: number;
}

interface DemoPreset {
  id: string;
  label: string;
  hint: string;
  dataUrl: string;
}

interface RoiBox {
  x: number; // normalized 0..1
  y: number;
  w: number;
  h: number;
}

interface PhotoItemEntry {
  id: string;
  rawSrc: string;
  annotatedSrc: string;
  label: string;
  boxes: RoiBox[];
  roiCoveragePct: number;
}

const SEVERITY_BADGE_CLASSES: Record<DamageSeverity, string> = {
  NONE: 'border-ink text-ink',
  MINOR: 'border-ink text-ink',
  MODERATE: 'border-amber-600 text-amber-700 bg-amber-50/60',
  SEVERE: 'border-hazard text-hazard bg-hazard/10',
  TOTAL_LOSS: 'border-hazard bg-hazard text-paper',
};

/**
 * Downscales large smartphone/camera photos on a client canvas so up to 8 uploaded photos
 * stay fast over the wire and fit comfortably inside JSON & Server Action payloads.
 */
async function compressImageDataUrl(dataUrl: string, maxDim = 960, quality = 0.8): Promise<string> {
  if (!dataUrl.startsWith('data:image/') || dataUrl.startsWith('data:image/svg+xml')) {
    return dataUrl;
  }
  if (dataUrl.length < 180_000) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function computeBoxesCoveragePct(boxes: RoiBox[]): number {
  if (boxes.length === 0) return 0;
  const sumArea = boxes.reduce((acc, b) => acc + b.w * b.h, 0);
  return Math.min(100, Math.max(1, Math.round(sumArea * 100)));
}

/**
 * Renders the user-drawn red damage rectangles onto a copy of the photo so that
 * when the claim is saved and viewed later, the red damage markers are preserved.
 */
async function renderAnnotatedImage(rawSrc: string, boxes: RoiBox[]): Promise<string> {
  if (boxes.length === 0) return rawSrc;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width || 640;
        const height = img.naturalHeight || img.height || 420;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawSrc);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        boxes.forEach((box, idx) => {
          const rx = box.x * width;
          const ry = box.y * height;
          const rw = box.w * width;
          const rh = box.h * height;

          ctx.fillStyle = 'rgba(229, 57, 53, 0.16)';
          ctx.fillRect(rx, ry, rw, rh);

          ctx.strokeStyle = '#e53935';
          ctx.lineWidth = Math.max(3, Math.round(Math.min(width, height) * 0.006));
          ctx.strokeRect(rx, ry, rw, rh);

          const areaPct = Math.max(1, Math.round(box.w * box.h * 100));
          const tagText = `DAMAGE ROI #${idx + 1} (${areaPct}%)`;
          const fontSize = Math.max(11, Math.round(Math.min(width, height) * 0.028));
          ctx.font = `bold ${fontSize}px monospace`;
          const textW = ctx.measureText(tagText).width + 12;
          const tagH = fontSize + 8;
          const tagY = ry >= tagH ? ry - tagH : ry;

          ctx.fillStyle = '#e53935';
          ctx.fillRect(rx, tagY, textW, tagH);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(tagText, rx + 6, tagY + fontSize);
        });

        resolve(canvas.toDataURL('image/jpeg', 0.84));
      } catch {
        resolve(rawSrc);
      }
    };
    img.onerror = () => resolve(rawSrc);
    img.src = rawSrc;
  });
}

export function ClaimForm({
  movers,
  completedMoves = [],
  defaultMoveReference,
  defaultMoverId,
}: {
  movers: { id: string; name: string }[];
  completedMoves?: CompletedMoveOption[];
  /** Pre-selected move (e.g. from the tracking page). */
  defaultMoveReference?: string;
  defaultMoverId?: string;
}) {
  const router = useRouter();
  const token = useAuthStore((s) => s.accessToken);
  const [state, formAction] = useActionState(createClaimAction, initialActionState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  // Selected Completed Move (required when filing a claim)
  const defaultMove =
    completedMoves.find((move) => move.moveReference === defaultMoveReference) ?? completedMoves[0];
  const [selectedMoveRef, setSelectedMoveRef] = useState<string>(
    values.moveReference ?? defaultMove?.moveReference ?? defaultMoveReference ?? '',
  );
  const [selectedMoverId, setSelectedMoverId] = useState<string>(
    values.moverId ?? defaultMove?.moverId ?? defaultMoverId ?? movers[0]?.id ?? '',
  );

  // Controlled form fields so Vision AI can auto-fill them in 1 click
  const [subject, setSubject] = useState(values.subject ?? '');
  const [category, setCategory] = useState<ClaimCategory>(
    (values.category as ClaimCategory) ?? 'DAMAGE',
  );
  const [amountClaimed, setAmountClaimed] = useState(values.amountClaimed ?? '');
  const [description, setDescription] = useState(values.description ?? '');

  // Multi-photo + Red Rectangle ROI state
  const [photoEntries, setPhotoEntries] = useState<PhotoItemEntry[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [visionHint, setVisionHint] = useState('');
  const [activePresetId, setActivePresetId] = useState<string | undefined>(undefined);
  const [presets, setPresets] = useState<DemoPreset[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [visionResult, setVisionResult] = useState<{
    source: AnalysisSource;
    model: string | null;
    analysis: DamageVision;
  } | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pointer drag state for drawing red rectangles
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (state.ok && state.redirectTo) router.push(state.redirectTo);
  }, [router, state]);

  useEffect(() => {
    fetch('/api/ai/claims/vision', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => (res.ok ? (res.json() as Promise<{ presets: DemoPreset[] }>) : null))
      .then((data) => {
        if (data?.presets) setPresets(data.presets);
      })
      .catch(() => undefined);
  }, [token]);

  const handleSelectMove = (move: CompletedMoveOption) => {
    setSelectedMoveRef(move.moveReference);
    if (move.moverId) {
      setSelectedMoverId(move.moverId);
    }
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 8 - photoEntries.length);
    setActivePresetId(undefined);
    for (const file of files) {
      const reader = new FileReader();
      const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      reader.onload = async () => {
        if (typeof reader.result === 'string') {
          const compressed = await compressImageDataUrl(reader.result);
          const defaultBox: RoiBox = { x: 0.22, y: 0.22, w: 0.56, h: 0.52 };
          const annotated = await renderAnnotatedImage(compressed, [defaultBox]);
          setPhotoEntries((prev) => {
            if (prev.length >= 8) return prev;
            const next = [
              ...prev,
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                rawSrc: compressed,
                annotatedSrc: annotated,
                label: /^[a-zA-Z\s]{3,40}$/.test(baseName) ? baseName : '',
                boxes: [defaultBox],
                roiCoveragePct: computeBoxesCoveragePct([defaultBox]),
              },
            ];
            setActivePhotoIndex(next.length - 1);
            return next;
          });
        }
      };
      reader.readAsDataURL(file);
    }
    event.target.value = '';
  };

  const selectPreset = async (preset: DemoPreset) => {
    const defaultBox: RoiBox = { x: 0.12, y: 0.28, w: 0.42, h: 0.42 };
    const entry: PhotoItemEntry = {
      id: `preset-${preset.id}`,
      rawSrc: preset.dataUrl,
      annotatedSrc: preset.dataUrl,
      label: preset.label,
      boxes: [defaultBox],
      roiCoveragePct: computeBoxesCoveragePct([defaultBox]),
    };
    setPhotoEntries([entry]);
    setActivePhotoIndex(0);
    setVisionHint(preset.hint);
    setActivePresetId(preset.id);
    setScanError(null);
    await runVisionScan([entry], preset.hint, preset.id);
  };

  const updatePhotoBoxes = async (index: number, nextBoxes: RoiBox[]) => {
    const current = photoEntries[index];
    if (!current) return;
    const annotated = await renderAnnotatedImage(current.rawSrc, nextBoxes);
    const roiCoveragePct = computeBoxesCoveragePct(nextBoxes);
    setPhotoEntries((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              boxes: nextBoxes,
              annotatedSrc: annotated,
              roiCoveragePct,
            }
          : item,
      ),
    );
  };

  const updatePhotoLabel = (index: number, label: string) => {
    setPhotoEntries((prev) => prev.map((item, idx) => (idx === index ? { ...item, label } : item)));
  };

  const removePhoto = (index: number) => {
    setPhotoEntries((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setActivePhotoIndex((curr) => Math.max(0, Math.min(curr, next.length - 1)));
      return next;
    });
    setVisionResult(null);
    setActivePresetId(undefined);
  };

  const getNormalizedCoords = (e: ReactPointerEvent<HTMLDivElement>): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / (rect.width || 1)));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / (rect.height || 1)));
    return { x, y };
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getNormalizedCoords(e);
    setDragStart(pt);
    setDragCurrent(pt);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    setDragCurrent(getNormalizedCoords(e));
  };

  const handlePointerUp = async (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart || !dragCurrent) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const x = Math.min(dragStart.x, dragCurrent.x);
    const y = Math.min(dragStart.y, dragCurrent.y);
    const w = Math.abs(dragCurrent.x - dragStart.x);
    const h = Math.abs(dragCurrent.y - dragStart.y);
    setDragStart(null);
    setDragCurrent(null);

    // Ignore tiny accidental clicks (< 3% width/height)
    if (w < 0.03 || h < 0.03) return;
    const active = photoEntries[activePhotoIndex];
    if (!active) return;
    setActivePresetId(undefined);
    const nextBoxes = [...active.boxes, { x, y, w, h }].slice(-6);
    await updatePhotoBoxes(activePhotoIndex, nextBoxes);
  };

  const runVisionScan = async (
    entries = photoEntries,
    hintText = visionHint,
    presetId = activePresetId,
  ) => {
    if (entries.length === 0 || scanning) return;
    setScanning(true);
    setScanError(null);
    setAutoFilled(false);
    try {
      const currentToken = useAuthStore.getState().accessToken;
      const response = await fetch('/api/ai/claims/vision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
        },
        body: JSON.stringify({
          images: entries.map((e) => e.annotatedSrc),
          hint: hintText || undefined,
          presetId,
          photoAnnotations: entries.map((e) => ({
            label: e.label.trim() || undefined,
            roiCoveragePct: e.roiCoveragePct,
            boxCount: e.boxes.length,
          })),
        }),
      });
      if (!response.ok) {
        throw new Error('Could not analyze photo');
      }
      const data = (await response.json()) as {
        source: AnalysisSource;
        model: string | null;
        analysis: DamageVision;
      };
      setVisionResult(data);
    } catch {
      setScanError('Vision AI could not inspect the photo. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const applyVisionToForm = () => {
    if (!visionResult) return;
    const { analysis } = visionResult;
    setSubject(analysis.suggestedSubject);
    setCategory(analysis.suggestedCategory);
    setAmountClaimed(String(analysis.recommendedClaimAmountTnd));
    setDescription(analysis.suggestedDescription);
    setAutoFilled(true);
  };

  const activePhoto = photoEntries[activePhotoIndex] ?? null;
  const previewDraftBox: RoiBox | null =
    dragStart && dragCurrent
      ? {
          x: Math.min(dragStart.x, dragCurrent.x),
          y: Math.min(dragStart.y, dragCurrent.y),
          w: Math.abs(dragCurrent.x - dragStart.x),
          h: Math.abs(dragCurrent.y - dragStart.y),
        }
      : null;

  return (
    <form
      action={formAction}
      className="grid gap-6 border border-ink bg-paper p-6 md:grid-cols-2"
      noValidate
    >
      {/* Hidden inputs pass annotated evidence photos, Vision AI JSON, and selected move straight into the Server Action */}
      <input
        type="hidden"
        name="evidencePhotos"
        value={JSON.stringify(photoEntries.map((e) => e.annotatedSrc))}
      />
      <input
        type="hidden"
        name="visionAnalysisJson"
        value={visionResult ? JSON.stringify(visionResult.analysis) : ''}
      />
      <input type="hidden" name="moveReference" value={selectedMoveRef} />

      {/* STEP 1: Classy Completed Move Selector (Required) */}
      <div className="space-y-3 border-2 border-ink bg-paper p-5 md:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="mono flex items-center gap-2 text-[11px] font-bold text-hazard">
              <Truck className="size-4" /> STEP 1 · SELECT WHICH COMPLETED MOVE THIS CLAIM CONCERNS
              *
            </p>
            <p className="mt-1 text-sm text-ink-80">
              Choose from your completed moves below. The move reference and assigned mover are
              linked automatically.
            </p>
          </div>
          {selectedMoveRef ? (
            <span className="mono border border-ink bg-ink px-2.5 py-1 text-[10px] font-bold text-paper">
              SELECTED: {selectedMoveRef}
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {completedMoves.map((move) => {
            const isSelected = selectedMoveRef === move.moveReference;
            return (
              <button
                key={move.moveReference}
                type="button"
                onClick={() => handleSelectMove(move)}
                className={`group relative flex flex-col justify-between border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-2 border-hazard bg-hazard/[0.06] shadow-[3px_3px_0px_0px_#e53935]'
                    : 'border-ink bg-paper hover:bg-ink/[0.03]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`mono px-2 py-0.5 text-[10px] font-bold ${
                      isSelected ? 'bg-hazard text-paper' : 'border border-ink text-ink'
                    }`}
                  >
                    {move.moveReference}
                  </span>
                  <span className="mono text-[10px] text-ink-80">{move.completedDate}</span>
                </div>
                <p className="mt-2.5 text-sm font-bold">{move.route}</p>
                <div className="mono mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-ink/15 pt-2 text-[10px] text-ink-80">
                  <span>MOVER: {move.moverName}</span>
                  <span>{move.truckTier}</span>
                </div>
              </button>
            );
          })}
        </div>
        <FieldError message={errors.moveReference?.[0]} />
      </div>

      {/* STEP 2: Multimodal Vision AI · Multi-Photo & Red Rectangle ROI Inspector */}
      <div className="space-y-4 border-2 border-ink bg-paper p-5 md:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mono flex items-center gap-2 text-[11px] font-bold text-hazard">
              <Camera className="size-4" /> STEP 2 · MULTIMODAL VISION AI & RED-RECTANGLE DAMAGE
              INSPECTOR
            </p>
            <p className="mt-1 text-sm text-ink-80">
              Upload up to 8 photos of broken/damaged items. Drag on any photo to draw a{' '}
              <strong className="text-hazard">red rectangle</strong> around the damaged area, or
              click a photo to inspect it full-screen. AI estimates the{' '}
              <strong>damage rate (%)</strong> and <strong>TND cost</strong> for every item.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoEntries.length >= 8 || scanning}
            >
              <Upload className="size-3.5" /> Add photos ({photoEntries.length}/8)
            </Button>
            {photoEntries.length > 0 ? (
              <Button
                type="button"
                variant="hazard"
                size="sm"
                onClick={() => void runVisionScan()}
                disabled={scanning}
              >
                {scanning ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Estimating damage rate…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" /> Scan {photoEntries.length} photo(s) with AI
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </div>

        {/* 1-Click Demo Presets */}
        {presets.length > 0 ? (
          <div className="space-y-1.5 border-t border-ink/20 pt-3">
            <p className="mono text-[10px] text-ink-80">
              INSTANT DEMO SAMPLES (CLICK TO LOAD & INSPECT):
            </p>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => void selectPreset(preset)}
                  disabled={scanning}
                  className={`mono border px-3 py-1.5 text-[10px] normal-case tracking-normal transition-colors ${
                    activePresetId === preset.id
                      ? 'border-hazard bg-hazard text-paper'
                      : 'border-ink bg-paper hover:bg-ink hover:text-paper'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Uploaded Photos Thumbnail Strip + Active Red-Rectangle Drawing Stage */}
        {photoEntries.length > 0 && activePhoto ? (
          <div className="space-y-4 border-t border-ink/20 pt-4">
            {/* Thumbnail Selector Strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photoEntries.map((entry, index) => {
                const isActive = index === activePhotoIndex;
                return (
                  <div
                    key={entry.id}
                    className={`flex flex-col border transition-all ${
                      isActive ? 'border-2 border-hazard bg-hazard/5' : 'border-ink bg-paper'
                    }`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setActivePhotoIndex(index)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setActivePhotoIndex(index);
                      }}
                      className="group relative cursor-pointer overflow-hidden bg-neutral-900"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.annotatedSrc}
                        alt={`Damaged item ${index + 1}`}
                        className="h-28 w-full object-cover"
                      />
                      <span className="mono absolute top-1.5 left-1.5 bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        #{index + 1} · ROI {entry.roiCoveragePct}%
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePhotoIndex(index);
                          setLightboxOpen(true);
                        }}
                        title="View full-size & draw red box"
                        className="mono absolute bottom-1.5 left-1.5 flex items-center gap-1 border border-white/60 bg-black/80 px-1.5 py-0.5 text-[9px] text-white hover:bg-hazard"
                      >
                        <Maximize2 className="size-2.5" /> ENLARGE
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePhoto(index);
                        }}
                        aria-label="Remove photo"
                        className="mono absolute top-1.5 right-1.5 border border-ink bg-paper p-1 text-[10px] hover:bg-hazard hover:text-paper"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                    <div className="p-2">
                      <input
                        type="text"
                        value={entry.label}
                        onChange={(e) => updatePhotoLabel(index, e.target.value)}
                        placeholder={`Item #${index + 1} (e.g. Broken plate)`}
                        className="mono w-full border border-ink/40 bg-paper px-2 py-1 text-[10px] normal-case focus:border-hazard focus:outline-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Interactive Red-Rectangle Annotator Stage for Active Photo */}
            <div className="grid gap-4 border border-ink bg-ink/[0.03] p-4 lg:grid-cols-12">
              <div className="space-y-2 lg:col-span-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="mono flex items-center gap-1.5 text-[10px] font-bold text-hazard">
                    <Crosshair className="size-3.5" /> DRAG ON PHOTO #{activePhotoIndex + 1} TO DRAW
                    RED DAMAGE RECTANGLE
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void updatePhotoBoxes(activePhotoIndex, [])}
                      className="mono flex items-center gap-1 border border-ink bg-paper px-2 py-0.5 text-[10px] hover:bg-ink hover:text-paper"
                    >
                      <RotateCcw className="size-3" /> Clear boxes ({activePhoto.boxes.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="mono flex items-center gap-1 border border-ink bg-ink px-2 py-0.5 text-[10px] text-paper hover:bg-hazard"
                    >
                      <Maximize2 className="size-3" /> Full-screen view
                    </button>
                  </div>
                </div>

                {/* Interactive Drawing Surface */}
                <div
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={(e) => void handlePointerUp(e)}
                  className="relative flex max-h-[340px] min-h-[240px] w-full cursor-crosshair touch-none select-none items-center justify-center overflow-hidden border-2 border-ink bg-neutral-950"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activePhoto.rawSrc}
                    alt={`Annotate photo ${activePhotoIndex + 1}`}
                    draggable={false}
                    className=" pointer-events-none max-h-[336px] w-full object-contain"
                  />
                  {/* Existing Red Rectangles */}
                  {activePhoto.boxes.map((box, idx) => (
                    <div
                      key={idx}
                      style={{
                        left: `${box.x * 100}%`,
                        top: `${box.y * 100}%`,
                        width: `${box.w * 100}%`,
                        height: `${box.h * 100}%`,
                      }}
                      className="pointer-events-none absolute border-2 border-hazard bg-hazard/20"
                    >
                      <span className="mono absolute -top-5 left-0 bg-hazard px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap text-paper">
                        ROI #{idx + 1} · {Math.max(1, Math.round(box.w * box.h * 100))}%
                      </span>
                    </div>
                  ))}
                  {/* Live Dragging Red Rectangle */}
                  {previewDraftBox ? (
                    <div
                      style={{
                        left: `${previewDraftBox.x * 100}%`,
                        top: `${previewDraftBox.y * 100}%`,
                        width: `${previewDraftBox.w * 100}%`,
                        height: `${previewDraftBox.h * 100}%`,
                      }}
                      className="pointer-events-none absolute border-2 border-dashed border-hazard bg-hazard/25"
                    />
                  ) : null}
                </div>
              </div>

              {/* Per-Photo Metadata & Global Context */}
              <div className="flex flex-col justify-between space-y-3 lg:col-span-5">
                <div className="space-y-3">
                  <div className="border border-ink bg-paper p-3">
                    <p className="mono text-[10px] text-ink-80">
                      PHOTO #{activePhotoIndex + 1} · MARKED DAMAGE ZONE
                    </p>
                    <p className="display mt-1 text-2xl text-hazard">
                      {activePhoto.roiCoveragePct}% OF SURFACE MARKED
                    </p>
                    <p className="mt-1 text-xs text-ink-80">
                      {activePhoto.boxes.length} red rectangle(s) drawn. Drag across any crack,
                      scratch, or broken shard on the photo to refine the AI damage rate.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="activeItemLabel">
                      Damaged item in Photo #{activePhotoIndex + 1}
                    </Label>
                    <Input
                      id="activeItemLabel"
                      value={activePhoto.label}
                      onChange={(e) => updatePhotoLabel(activePhotoIndex, e.target.value)}
                      placeholder="e.g. Broken ceramic plate, Scratched seat, Cracked TV…"
                      maxLength={120}
                    />
                  </div>

                  <div>
                    <Label htmlFor="visionHint">
                      Additional context across all photos (optional)
                    </Label>
                    <Input
                      id="visionHint"
                      value={visionHint}
                      onChange={(e) => setVisionHint(e.target.value)}
                      placeholder="e.g. Scratched a seat, broke a TV screen, broke two plates…"
                      maxLength={400}
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="hazard"
                  onClick={() => void runVisionScan()}
                  disabled={scanning}
                  className="w-full"
                >
                  {scanning ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Calculating AI Damage Rate…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" /> Estimate AI Damage Rate & TND Cost
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {scanError ? (
          <p role="alert" className="mono text-[11px] normal-case text-hazard">
            {scanError}
          </p>
        ) : null}

        {/* Vision AI Structured Output Card with Damage Rate % */}
        {visionResult ? (
          <div className="space-y-4 border-2 border-ink bg-ink/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/20 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`mono border px-2 py-0.5 text-[10px] font-bold ${
                    SEVERITY_BADGE_CLASSES[visionResult.analysis.overallSeverity]
                  }`}
                >
                  {DAMAGE_SEVERITY_LABELS[visionResult.analysis.overallSeverity].toUpperCase()}
                </span>
                <span className="mono border border-hazard bg-hazard/10 px-2 py-0.5 text-[10px] font-bold text-hazard">
                  OVERALL DAMAGE RATE: {visionResult.analysis.overallDamageRatePct ?? 65}%
                </span>
                <span className="mono border border-ink px-2 py-0.5 text-[10px]">
                  CONFIDENCE {Math.round(visionResult.analysis.confidence * 100)}%
                </span>
              </div>
              <Button type="button" variant="hazard" size="sm" onClick={applyVisionToForm}>
                {autoFilled ? (
                  <>
                    <CheckCircle2 className="size-3.5" /> Applied to form
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" /> Auto-fill claim form
                  </>
                )}
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="border border-ink bg-paper p-3">
                <p className="mono text-[10px] text-ink-80">AI DAMAGE RATE</p>
                <p className="display mt-1 text-2xl text-hazard">
                  {visionResult.analysis.overallDamageRatePct ?? 65}%
                </p>
                <div className="mt-1.5 h-2 w-full border border-ink bg-ink/10">
                  <div
                    className="h-full bg-hazard"
                    style={{ width: `${visionResult.analysis.overallDamageRatePct ?? 65}%` }}
                  />
                </div>
              </div>
              <div className="border border-ink bg-paper p-3">
                <p className="mono text-[10px] text-ink-80">ESTIMATED REPAIR RANGE</p>
                <p className="display mt-1 text-xl">
                  {visionResult.analysis.estimatedRepairMinTnd} –{' '}
                  {visionResult.analysis.estimatedRepairMaxTnd} TND
                </p>
              </div>
              <div className="border border-hazard bg-paper p-3">
                <p className="mono text-[10px] text-hazard">RECOMMENDED CLAIM AMOUNT</p>
                <p className="display mt-1 text-xl text-hazard">
                  {visionResult.analysis.recommendedClaimAmountTnd} TND
                </p>
              </div>
              <div className="border border-ink bg-paper p-3">
                <p className="mono text-[10px] text-ink-80">DETECTED BROKEN ITEMS</p>
                <p className="display mt-1 text-xl">
                  {visionResult.analysis.detectedItems.length} item(s)
                </p>
              </div>
            </div>

            <ul className="space-y-2">
              {visionResult.analysis.detectedItems.map((item, idx) => (
                <li
                  key={idx}
                  onClick={() => {
                    if (photoEntries[idx]) {
                      setActivePhotoIndex(idx);
                      setLightboxOpen(true);
                    }
                  }}
                  className="flex cursor-pointer flex-wrap items-center justify-between gap-3 border border-ink/40 bg-paper px-3 py-2.5 text-xs transition-colors hover:border-hazard"
                >
                  <div className="min-w-[220px] flex-1">
                    <p className="font-bold">
                      #{idx + 1} · {item.name}{' '}
                      <span className="font-normal text-ink-80">({item.material})</span>
                    </p>
                    <p className="mt-0.5 text-ink-80">{item.damageType}</p>
                  </div>
                  <div className="w-36">
                    <div className="mono flex justify-between text-[10px]">
                      <span>DAMAGE RATE</span>
                      <span className="font-bold text-hazard">{item.damageRatePct ?? 50}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full border border-ink bg-ink/10">
                      <div
                        className="h-full bg-hazard"
                        style={{ width: `${item.damageRatePct ?? 50}%` }}
                      />
                    </div>
                  </div>
                  <div className="mono text-right text-[10px]">
                    <p className="text-xs font-bold">{item.estimatedCostTnd} TND</p>
                    <p className="text-ink-80">
                      {item.repairable ? 'Repairable' : 'Replacement required'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mono text-[10px] normal-case tracking-normal text-ink-80">
              <strong>Visual check:</strong> {visionResult.analysis.authenticityNotes}
            </p>
          </div>
        ) : null}
      </div>

      {/* Full-Screen Photo Lightbox + Red Rectangle Editor Modal */}
      {lightboxOpen && activePhoto ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden border-2 border-ink bg-paper text-ink shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink bg-ink px-4 py-3 text-paper">
              <div className="flex items-center gap-3">
                <span className="mono bg-hazard px-2 py-0.5 text-[10px] font-bold text-paper">
                  PHOTO {activePhotoIndex + 1} OF {photoEntries.length}
                </span>
                <span className="mono text-xs font-bold">
                  {activePhoto.label || `Damaged Item #${activePhotoIndex + 1}`} · Drag on photo to
                  draw red rectangle
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void updatePhotoBoxes(activePhotoIndex, [])}
                  className="mono border border-paper/40 px-2.5 py-1 text-[10px] text-paper hover:bg-paper hover:text-ink"
                >
                  CLEAR BOXES
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  className="mono flex items-center gap-1 border border-paper/40 px-2.5 py-1 text-[10px] text-paper hover:bg-hazard"
                >
                  <X className="size-3.5" /> DONE
                </button>
              </div>
            </div>

            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => void handlePointerUp(e)}
              className="relative flex min-h-[380px] flex-1 cursor-crosshair touch-none select-none items-center justify-center overflow-hidden bg-neutral-950"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePhoto.rawSrc}
                alt={`Full size ${activePhotoIndex + 1}`}
                draggable={false}
                className="pointer-events-none max-h-[68vh] w-full object-contain"
              />
              {activePhoto.boxes.map((box, idx) => (
                <div
                  key={idx}
                  style={{
                    left: `${box.x * 100}%`,
                    top: `${box.y * 100}%`,
                    width: `${box.w * 100}%`,
                    height: `${box.h * 100}%`,
                  }}
                  className="pointer-events-none absolute border-2 border-hazard bg-hazard/20"
                >
                  <span className="mono absolute -top-5 left-0 bg-hazard px-1.5 py-0.5 text-[10px] font-bold text-paper">
                    DAMAGE ROI #{idx + 1} ({Math.max(1, Math.round(box.w * box.h * 100))}%)
                  </span>
                </div>
              ))}
              {previewDraftBox ? (
                <div
                  style={{
                    left: `${previewDraftBox.x * 100}%`,
                    top: `${previewDraftBox.y * 100}%`,
                    width: `${previewDraftBox.w * 100}%`,
                    height: `${previewDraftBox.h * 100}%`,
                  }}
                  className="pointer-events-none absolute border-2 border-dashed border-hazard bg-hazard/25"
                />
              ) : null}

              {photoEntries.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhotoIndex(
                        (prev) => (prev - 1 + photoEntries.length) % photoEntries.length,
                      )
                    }
                    className="absolute left-3 border border-white/40 bg-black/75 p-2 text-white hover:bg-hazard"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePhotoIndex((prev) => (prev + 1) % photoEntries.length)}
                    className="absolute right-3 border border-white/40 bg-black/75 p-2 text-white hover:bg-hazard"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink bg-paper p-4">
              <div className="mono text-xs">
                <strong>Marked Damage Surface:</strong> {activePhoto.roiCoveragePct}% (
                {activePhoto.boxes.length} red rectangle(s))
              </div>
              <Button
                type="button"
                variant="hazard"
                size="sm"
                onClick={() => {
                  setLightboxOpen(false);
                  void runVisionScan();
                }}
              >
                <Sparkles className="size-3.5" /> Re-calculate AI Damage Rate
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* STEP 3: Claim Details */}
      <div className="md:col-span-2">
        <Label htmlFor="subject">Subject *</Label>
        <Input
          id="subject"
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Glass table broken during unloading"
          aria-invalid={Boolean(errors.subject)}
          maxLength={120}
          required
        />
        <FieldError message={errors.subject?.[0]} />
      </div>

      <div>
        <Label htmlFor="category">Category *</Label>
        <NativeSelect
          id="category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ClaimCategory)}
        >
          {CLAIM_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CLAIM_CATEGORY_LABELS[cat]}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div>
        <Label htmlFor="moverId">Mover concerned (auto-linked from move)</Label>
        <NativeSelect
          id="moverId"
          name="moverId"
          value={selectedMoverId}
          onChange={(e) => setSelectedMoverId(e.target.value)}
          aria-invalid={Boolean(errors.moverId)}
        >
          <option value="">— Not sure / not applicable —</option>
          {movers.map((mover) => (
            <option key={mover.id} value={mover.id}>
              {mover.name}
            </option>
          ))}
        </NativeSelect>
        <FieldError message={errors.moverId?.[0]} />
      </div>

      <div className="md:col-span-2">
        <Label htmlFor="amountClaimed">Amount claimed (TND)</Label>
        <Input
          id="amountClaimed"
          name="amountClaimed"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.001"
          value={amountClaimed}
          onChange={(e) => setAmountClaimed(e.target.value)}
          aria-invalid={Boolean(errors.amountClaimed)}
        />
        <FieldError message={errors.amountClaimed?.[0]} />
      </div>

      <div className="md:col-span-2">
        <Label htmlFor="description">What happened? *</Label>
        <Textarea
          id="description"
          name="description"
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue: when, which items, what you expect…"
          aria-invalid={Boolean(errors.description)}
          maxLength={2000}
          required
        />
        <FieldError message={errors.description?.[0]} />
      </div>

      <div className="flex flex-col gap-4 md:col-span-2 md:flex-row md:items-center md:justify-between">
        <FormMessage ok={state.ok} message={state.message} />
        <SubmitButton variant="hazard" pendingLabel="Submitting…" className="md:ml-auto">
          Submit claim
        </SubmitButton>
      </div>
    </form>
  );
}
