'use client';

import { useRef } from 'react';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { SectionHeading } from '@/components/shared/section-heading';
import type { LandingMessages } from '@/lib/i18n/landing';
import { LANDING_PHOTOS, type LandingPhotoSlug } from './photos';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const CITY_PHOTOS: LandingPhotoSlug[] = ['city-tunis', 'city-sfax', 'city-sousse'];

/**
 * Coverage — Desire. Sticky title column; three launch-city plates that open
 * like shutters as they enter. Only cities MoveUp actually serves are listed.
 */
export function Coverage({ intro, t }: { intro: string; t: LandingMessages['coverage'] }) {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      gsap.utils.toArray<HTMLElement>('[data-city]').forEach((card, index) => {
        const plate = card.querySelector('[data-city-plate]');
        gsap.fromTo(
          plate,
          { clipPath: 'inset(0% 0% 100% 0%)' },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            duration: 1.3,
            delay: index * 0.12,
            ease: 'expo.inOut',
            scrollTrigger: { trigger: card, start: 'top 85%', once: true },
          },
        );
        gsap.fromTo(
          card.querySelector('img'),
          { yPercent: -8 },
          {
            yPercent: 8,
            ease: 'none',
            scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        );
      });
    },
    { scope: rootRef },
  );

  return (
    <section
      id="coverage"
      tabIndex={-1}
      ref={rootRef}
      aria-labelledby="coverage-title"
      className="scroll-mt-14 border-b border-ink bg-paper outline-none"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 py-24 md:grid-cols-12 md:px-6 md:py-32">
        <div className="md:col-span-4">
          <div className="md:sticky md:top-28">
            <SectionHeading
              id="coverage-title"
              index={t.index}
              title={t.title}
              size="column"
              className="mb-8"
            />
            <p className="max-w-[36ch] text-sm leading-relaxed text-ink-80">{intro}</p>
            <p className="mono mt-6 max-w-[36ch] text-[11px] leading-relaxed text-ink-60">
              {t.footnote}
            </p>
          </div>
        </div>

        <ul className="grid grid-cols-1 gap-px border border-ink bg-ink sm:grid-cols-3 md:col-span-8">
          {t.cities.map((city, index) => {
            const photo = LANDING_PHOTOS[CITY_PHOTOS[index] ?? 'city-tunis'];
            return (
              <li key={city.code} data-city className="relative bg-paper">
                <div data-city-plate className="relative aspect-[3/4] overflow-hidden">
                  <Image
                    src={photo.src}
                    alt={city.alt}
                    fill
                    sizes="(min-width: 768px) 22vw, (min-width: 640px) 33vw, 100vw"
                    className="scale-110 object-cover contrast-125 grayscale"
                  />
                  <span className="mono absolute left-3 top-3 bg-ink px-2 py-1 text-[11px] text-paper">
                    {city.note}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-ink px-4 py-3">
                  <span className="display text-xl">{city.name}</span>
                  <span className="mono text-[11px] text-hazard-ink">
                    {city.code}/{`0${index + 1}`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
