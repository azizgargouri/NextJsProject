'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import { DAMAGE_SEVERITY_LABELS, type DamageSeverity } from '@/lib/quality/constants';

export interface GalleryDetectedItem {
  name: string;
  material: string;
  damageType: string;
  severity: DamageSeverity;
  damageRatePct?: number;
  roiCoveragePct?: number;
  repairable: boolean;
  estimatedCostTnd: number;
}

/**
 * Clickable photo grid + full-screen Lightbox Viewer so clients, movers, and back-office
 * admins can click any evidence photo to inspect it in high resolution with its AI Damage Rate %.
 */
export function EvidencePhotoGallery({
  photos,
  detectedItems = [],
  variant = 'workspace',
}: {
  photos: string[];
  detectedItems?: GalleryDetectedItem[];
  variant?: 'workspace' | 'admin';
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!photos || photos.length === 0) return null;

  const activePhoto = activeIndex !== null ? photos[activeIndex] : null;
  const activeItem =
    activeIndex !== null ? (detectedItems[activeIndex] ?? detectedItems[0] ?? null) : null;

  return (
    <>
      <div
        className={
          variant === 'admin'
            ? 'grid grid-cols-2 gap-2.5 sm:grid-cols-3'
            : 'grid grid-cols-2 gap-3 sm:grid-cols-4'
        }
      >
        {photos.map((src, index) => {
          const item = detectedItems[index];
          return (
            <button
              key={index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`group relative overflow-hidden text-left transition-all ${
                variant === 'admin'
                  ? 'rounded-md border bg-muted/20 hover:border-primary'
                  : 'border border-ink bg-ink/5 hover:border-hazard'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Evidence photo ${index + 1}`}
                className="h-32 w-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                <span className="mono flex items-center gap-1.5 border border-white bg-black/80 px-2.5 py-1 text-[10px] font-bold text-white">
                  <Maximize2 className="size-3" /> VIEW PHOTO #{index + 1}
                </span>
              </div>
              {item ? (
                <div
                  className={
                    variant === 'admin'
                      ? 'border-t bg-background/95 px-2 py-1 text-[11px]'
                      : 'mono border-t border-ink bg-paper px-2 py-1 text-[10px]'
                  }
                >
                  <p className="truncate font-bold">{item.name}</p>
                  <p className="text-[10px] opacity-75">
                    Damage {item.damageRatePct ?? (item.repairable ? 45 : 95)}% ·{' '}
                    {item.estimatedCostTnd} TND
                  </p>
                </div>
              ) : (
                <div
                  className={
                    variant === 'admin'
                      ? 'border-t bg-background/95 px-2 py-1 text-[11px]'
                      : 'mono border-t border-ink bg-paper px-2 py-1 text-[10px]'
                  }
                >
                  Photo #{index + 1} · Click to enlarge
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Full-Screen Lightbox Modal */}
      {activeIndex !== null && activePhoto ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Evidence Photo Inspector"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs"
          onClick={() => setActiveIndex(null)}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden border-2 border-ink bg-paper text-ink shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-ink bg-ink px-4 py-3 text-paper">
              <div className="flex items-center gap-3">
                <span className="mono bg-hazard px-2 py-0.5 text-[10px] font-bold text-paper">
                  PHOTO {activeIndex + 1} OF {photos.length}
                </span>
                <span className="mono text-xs font-bold">
                  {activeItem ? activeItem.name : `Evidence Photo #${activeIndex + 1}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveIndex(null)}
                className="mono flex items-center gap-1 border border-paper/40 px-2.5 py-1 text-[10px] text-paper hover:bg-hazard"
              >
                <X className="size-3.5" /> CLOSE
              </button>
            </div>

            {/* Image Stage */}
            <div className="relative flex min-h-[340px] flex-1 items-center justify-center bg-neutral-950 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePhoto}
                alt={`Evidence ${activeIndex + 1}`}
                className="max-h-[64vh] w-auto max-w-full object-contain"
              />
              {photos.length > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={() =>
                      setActiveIndex((prev) =>
                        prev !== null ? (prev - 1 + photos.length) % photos.length : 0,
                      )
                    }
                    className="absolute left-3 border border-white/40 bg-black/75 p-2 text-white hover:bg-hazard"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={() =>
                      setActiveIndex((prev) => (prev !== null ? (prev + 1) % photos.length : 0))
                    }
                    className="absolute right-3 border border-white/40 bg-black/75 p-2 text-white hover:bg-hazard"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              ) : null}
            </div>

            {/* Footer with AI Item Inspection Metrics */}
            {activeItem ? (
              <div className="grid gap-3 border-t border-ink bg-paper p-4 sm:grid-cols-4">
                <div>
                  <p className="mono text-[10px] text-ink-80">ITEM & MATERIAL</p>
                  <p className="mt-0.5 text-xs font-bold">{activeItem.name}</p>
                  <p className="text-[11px] text-ink-80">{activeItem.material}</p>
                </div>
                <div>
                  <p className="mono text-[10px] text-ink-80">AI DAMAGE RATE</p>
                  <p className="display mt-0.5 text-xl text-hazard">
                    {activeItem.damageRatePct ?? (activeItem.repairable ? 45 : 95)}%
                  </p>
                  <div className="mt-1 h-1.5 w-full border border-ink bg-ink/10">
                    <div
                      className="h-full bg-hazard"
                      style={{
                        width: `${activeItem.damageRatePct ?? (activeItem.repairable ? 45 : 95)}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <p className="mono text-[10px] text-ink-80">SEVERITY & STATUS</p>
                  <p className="mono mt-0.5 text-[11px] font-bold">
                    {DAMAGE_SEVERITY_LABELS[activeItem.severity]}
                  </p>
                  <p className="mono text-[10px] text-ink-80">
                    {activeItem.repairable ? 'Repairable' : 'Replacement required'}
                  </p>
                </div>
                <div>
                  <p className="mono text-[10px] text-ink-80">ASSESSED COST</p>
                  <p className="display mt-0.5 text-xl">{activeItem.estimatedCostTnd} TND</p>
                  {activeItem.roiCoveragePct ? (
                    <p className="mono text-[10px] text-hazard">
                      Red ROI zone: {activeItem.roiCoveragePct}% area
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

