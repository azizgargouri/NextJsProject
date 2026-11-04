'use client';

import { useRef } from 'react';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { SectionHeading } from '@/components/shared/section-heading';
import { fill, type LandingMessages } from '@/lib/i18n/landing';
import { LANDING_PHOTOS, type LandingPhotoSlug } from './photos';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const STEP_PHOTOS: LandingPhotoSlug[] = [
  'step-open-box',
  'step-sealed-box',
  'step-dolly',
  'step-street-truck',
];

/**
 * How it works — Desire. On desktop the section is exactly one viewport tall
 * and pins; vertical scroll drives the horizontal rail (ease "none" keeps the
 * mapping 1:1) and a progress rule that fills with it. Mobile stacks the steps.
 */
export function HowItWorks({
  steps,
  t,
}: {
  steps: { title: string; body: string }[];
  t: LandingMessages['how'];
}) {
  const rootRef = useRef<HTMLElement>(null);
  const carrierRef = useRef<HTMLOListElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap
        .matchMedia()
        .add(
          { isDesktop: '(min-width: 768px)', reduce: '(prefers-reduced-motion: reduce)' },
          (context) => {
            const { isDesktop, reduce } = context.conditions ?? {};
            const carrier = carrierRef.current;
            if (!isDesktop || reduce || !carrier) return;

            const distance = () => Math.max(0, carrier.scrollWidth - window.innerWidth);
            const rail = gsap.to(carrier, {
              x: () => -distance(),
              ease: 'none',
              scrollTrigger: {
                trigger: rootRef.current,
                pin: true,
                scrub: 0.8,
                start: 'top top',
                end: () => `+=${distance()}`,
                invalidateOnRefresh: true,
                onUpdate: (self) => {
                  if (progressRef.current) gsap.set(progressRef.current, { scaleX: self.progress });
                },
              },
            });

            gsap.utils.toArray<HTMLElement>('[data-step-photo]').forEach((photo) => {
              gsap.fromTo(
                photo,
                { clipPath: 'inset(0% 100% 0% 0%)' },
                {
                  clipPath: 'inset(0% 0% 0% 0%)',
                  ease: 'none',
                  scrollTrigger: {
                    trigger: photo,
                    containerAnimation: rail,
                    start: 'left 95%',
                    end: 'left 55%',
                    scrub: true,
                  },
                },
              );
            });
          },
        );
    },
    { scope: rootRef },
  );

  return (
    <section
      id="how-it-works"
      tabIndex={-1}
      ref={rootRef}
      aria-labelledby="how-title"
      className="overflow-hidden border-b border-ink bg-paper outline-none md:flex md:h-dvh md:flex-col"
    >
      <div className="mx-auto w-full max-w-7xl px-4 pt-24 md:px-6 md:pt-20">
        <SectionHeading id="how-title" index={t.index} title={t.title} className="mb-8" />
      </div>

      {/* Desktop rail */}
      <div className="relative hidden min-h-0 flex-1 md:flex md:flex-col">
        <div className="flex min-h-0 flex-1 items-stretch pb-14">
          <ol ref={carrierRef} className="flex h-full max-h-[560px] gap-px self-center bg-ink px-6">
            {steps.map((step, index) => {
              const photo = LANDING_PHOTOS[STEP_PHOTOS[index] ?? 'step-open-box'];
              return (
                <li
                  key={index}
                  className="flex h-full w-[min(72vw,880px)] shrink-0 border border-ink bg-paper lg:w-[min(56vw,880px)]"
                >
                  <div className="relative w-1/2 shrink-0 overflow-hidden border-r border-ink bg-paper-soft">
                    <div data-step-photo className="absolute inset-0">
                      <Image
                        src={photo.src}
                        alt={t.photoAlts[index] ?? ''}
                        fill
                        sizes="(min-width: 1024px) 28vw, 36vw"
                        className="object-cover contrast-125 grayscale"
                      />
                    </div>
                    <span className="mono absolute bottom-3 left-3 bg-ink px-2 py-1 text-[11px] text-paper">
                      {fill(t.step, { n: `0${index + 1}` })}
                    </span>
                    <span className="mono absolute right-3 top-3 bg-hazard-dark px-2 py-1 text-[11px] text-white">
                      {t.statuses[index]}
                    </span>
                  </div>

                  <div className="flex w-1/2 flex-col justify-between p-8">
                    <div>
                      <p className="mono text-[11px] text-ink-60">
                        {fill(t.of, { n: `0${index + 1}` })}
                      </p>
                      <h3 className="display mt-4 text-[clamp(1.75rem,3vw,3rem)]">{step.title}</h3>
                      <p className="mt-5 max-w-[36ch] text-sm leading-relaxed text-ink-80">
                        {step.body}
                      </p>
                    </div>
                    <p className="mono text-[11px] text-hazard-ink">
                      {index < steps.length - 1 ? t.next : t.final}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="absolute inset-x-0 bottom-6 mx-auto w-full max-w-md px-6">
          <div aria-hidden className="relative h-0.5 w-full overflow-hidden bg-ink/20">
            <div ref={progressRef} className="absolute inset-0 origin-left scale-x-0 bg-hazard" />
          </div>
        </div>
      </div>

      {/* Mobile stack */}
      <div className="px-4 pb-24 md:hidden">
        <ol className="grid grid-cols-1 gap-px border border-ink bg-ink">
          {steps.map((step, index) => {
            const photo = LANDING_PHOTOS[STEP_PHOTOS[index] ?? 'step-open-box'];
            return (
              <li key={index} className="bg-paper">
                <div className="relative aspect-[16/9] overflow-hidden border-b border-ink">
                  <Image
                    src={photo.src}
                    alt={t.photoAlts[index] ?? ''}
                    fill
                    sizes="100vw"
                    className="object-cover contrast-125 grayscale"
                  />
                </div>
                <div className="p-6">
                  <p className="mono text-[11px] text-hazard-ink">
                    {fill(t.step, { n: `0${index + 1}` })} · {t.statuses[index]}
                  </p>
                  <h3 className="display mt-2 text-2xl">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-80">{step.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
