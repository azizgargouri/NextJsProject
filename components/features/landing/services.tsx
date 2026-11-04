'use client';

import { useRef } from 'react';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { SectionHeading } from '@/components/shared/section-heading';
import type { LandingMessages } from '@/lib/i18n/landing';
import { LANDING_PHOTOS } from './photos';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Services — Interest. Gapless 4-column bento: SV-01 spans two rows beside
 * SV-02/SV-03, then SV-04/SV-05 close the grid. No empty cells at any width.
 */
export function Services({ t }: { t: LandingMessages['services'] }) {
  const rootRef = useRef<HTMLElement>(null);
  const photo = LANDING_PHOTOS['service-boxes'];

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      gsap.utils.toArray<HTMLElement>('[data-service-cell]').forEach((cell) => {
        gsap.from(cell, {
          y: 32,
          autoAlpha: 0,
          duration: 0.9,
          ease: 'expo.out',
          scrollTrigger: { trigger: cell, start: 'top 90%', once: true },
        });
      });

      gsap.fromTo(
        '[data-service-image] img',
        { scale: 1.18 },
        {
          scale: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: '[data-service-image]',
            start: 'top bottom',
            end: 'bottom center',
            scrub: true,
          },
        },
      );
    },
    { scope: rootRef },
  );

  return (
    <section
      id="services"
      tabIndex={-1}
      ref={rootRef}
      aria-labelledby="services-title"
      className="scroll-mt-14 border-b border-ink bg-paper-soft outline-none"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-24 md:px-6 md:py-32">
        <SectionHeading id="services-title" index={t.index} title={t.title} className="mb-12" />

        <ul className="grid grid-flow-dense grid-cols-4 gap-px border border-ink bg-ink">
          {t.items.map((service, index) => (
            <li
              key={service.tag}
              className={`group relative bg-paper p-6 transition-colors duration-300 hover:bg-ink hover:text-paper md:p-8 ${
                index === 0 ? 'col-span-4 md:col-span-2 md:row-span-2' : 'col-span-4 md:col-span-2'
              }`}
            >
              <div data-service-cell>
                {index === 0 ? (
                  <div
                    data-service-image
                    className="relative mb-6 aspect-[4/3] overflow-hidden border border-ink md:aspect-auto md:h-72"
                  >
                    <Image
                      src={photo.src}
                      alt={t.photoAlt}
                      fill
                      sizes="(min-width: 768px) 40vw, 100vw"
                      className="object-cover object-[50%_60%] contrast-125 grayscale"
                    />
                  </div>
                ) : null}
                <p className="mono text-[11px] text-hazard-ink group-hover:text-hazard-glow">
                  {service.tag}
                </p>
                <h3 className="display mt-2 text-2xl md:text-3xl">{service.title}</h3>
                <p className="mt-3 max-w-[40ch] text-sm leading-relaxed text-ink-80 group-hover:text-paper/80">
                  {service.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
