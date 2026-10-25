'use client';

import { useRef } from 'react';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { SectionHeading } from '@/components/shared/section-heading';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Services — Interest block.
 * Gapless 4-column bento: rows [2+2][2(SV-01 continues)+2][2+2] interlock
 * perfectly — zero empty cells, grid-flow-dense enforces density if content shifts.
 */
const SERVICES = [
  {
    tag: 'SV-01',
    title: 'HOUSE MOVES',
    body: 'Studio to 6-room homes. Floors counted, elevators declared, nothing vague.',
    span: 'col-span-4 md:col-span-2 row-span-2',
    image: true,
    seed: 'moveup-house',
  },
  {
    tag: 'SV-02',
    title: 'SINGLE-ITEM HAULS',
    body: 'One sofa, one fridge. City-rate trips without the full-service invoice.',
    span: 'col-span-4 md:col-span-2',
    image: false,
  },
  {
    tag: 'SV-03',
    title: 'PACKING & MATERIALS',
    body: 'Boxes, film, padded blankets — ordered with the move, packed by the crew.',
    span: 'col-span-4 md:col-span-2',
    image: false,
  },
  {
    tag: 'SV-04',
    title: 'DISASSEMBLY',
    body: 'Beds, wardrobes, tables. Taken down, wrapped, rebuilt at destination.',
    span: 'col-span-4 md:col-span-2',
    image: false,
  },
  {
    tag: 'SV-05',
    title: 'OFFICE RELOCATIONS',
    body: 'Business moves run over a weekend — back online before Monday.',
    span: 'col-span-4 md:col-span-2',
    image: false,
  },
];

export function Services() {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      gsap.utils.toArray<gsap.TweenTarget>('[data-service-cell]').forEach((cell) => {
        gsap.from(cell, {
          y: 40,
          autoAlpha: 0,
          duration: 0.8,
          scrollTrigger: { trigger: cell as Element, start: 'top 88%', once: true },
        });
      });

      const strip = document.querySelector('[data-service-image]') as HTMLElement | null;
      if (strip) {
        gsap.fromTo(
          strip.querySelector('img'),
          { scale: 0.85 },
          {
            scale: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: strip,
              start: 'top bottom',
              end: 'center center',
              scrub: 1,
            },
          },
        );
      }
    },
    { scope: rootRef },
  );

  return (
    <section id="services" ref={rootRef} className="border-b border-ink bg-paper-soft">
      <div className="mx-auto w-full max-w-7xl px-4 py-24 md:px-6 md:py-32">
        <SectionHeading index="01 —" title="[ WHAT WE MOVE ]" className="mb-12" />

        <div className="grid grid-flow-dense grid-cols-4 gap-px border border-ink bg-ink">
          {SERVICES.map((service) => (
            <article
              key={service.tag}
              data-service-cell
              className={`group relative bg-paper p-6 transition-colors md:p-8 hover:bg-ink hover:text-paper ${service.span}`}
            >
              {service.image && (
                <div
                  data-service-image
                  className="relative mb-6 h-48 overflow-hidden border border-ink md:h-64"
                >
                  <Image
                    src={`https://picsum.photos/seed/${service.seed}/1200/800`}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover grayscale contrast-125 transition-opacity group-hover:opacity-80"
                  />
                </div>
              )}
              <p className="mono text-[10px] text-hazard">{service.tag}</p>
              <h3 className="display mt-2 text-2xl md:text-3xl">{service.title}</h3>
              <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-ink-80 group-hover:text-paper-soft/80">
                {service.body}
              </p>
              <span className="mono mt-4 inline-block text-[10px] opacity-0 transition-opacity group-hover:opacity-100">
                INCLUDED &gt;&gt;&gt;
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
