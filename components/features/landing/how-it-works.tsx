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
 * How it works — Desire block.
 * Pinned section; vertical scroll drives a horizontal carrier (containerAnimation).
 * The horizontal tween MUST use ease:"none" for a 1:1 scroll mapping.
 */
const STEPS = [
  {
    stage: 'STEP 01',
    status: 'DRAFT → SUBMITTED',
    title: 'REQUEST THE MOVE',
    body: 'Pickup, destination, floors, elevator, date. Five minutes, saved as a draft until you submit it.',
    seed: 'moveup-step1',
  },
  {
    stage: 'STEP 02',
    status: 'QUOTING',
    title: 'RECEIVE THE QUOTES',
    body: 'The society reviews the request and sends it to vetted movers in your zone with live vehicles.',
    seed: 'moveup-step2',
  },
  {
    stage: 'STEP 03',
    status: 'ASSIGNED',
    title: 'ACCEPT AND MEET YOUR MOVER',
    body: 'Compare price and rating, accept a quote, see the assigned crew profile, vehicle and reviews.',
    seed: 'moveup-step3',
  },
  {
    stage: 'STEP 04',
    status: 'EN ROUTE → COMPLETED',
    title: 'FOLLOW IT TO THE LAST BOX',
    body: 'Track every status change, chat with the mover, sign off delivery, pay and rate the job.',
    seed: 'moveup-step4',
  },
];

export function HowItWorks() {
  const rootRef = useRef<HTMLElement>(null);
  const carrierRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Mobile: no pinning, plain stacked reveals.
      gsap
        .matchMedia()
        .add(
          { isDesktop: '(min-width: 768px)', reduce: '(prefers-reduced-motion: reduce)' },
          (context) => {
            const { isDesktop, reduce } = context.conditions ?? {};
            if (!isDesktop || reduce) return;

            const carrier = carrierRef.current;
            if (!carrier) return;

            const horizontalTween = gsap.to(carrier, {
              x: () => -(carrier.scrollWidth - window.innerWidth),
              ease: 'none', // required for containerAnimation mapping
              scrollTrigger: {
                trigger: rootRef.current,
                pin: true,
                scrub: 1,
                start: 'top top',
                end: () => `+=${carrier.scrollWidth - window.innerWidth}`,
                invalidateOnRefresh: true,
              },
            });

            gsap.utils.toArray<gsap.TweenTarget>('[data-step-visual]').forEach((visual) => {
              gsap.from(visual, {
                scale: 0.8,
                autoAlpha: 0.2,
                ease: 'none',
                scrollTrigger: {
                  trigger: visual as Element,
                  containerAnimation: horizontalTween,
                  start: 'left 90%',
                  end: 'left 45%',
                  scrub: true,
                },
              });
            });
          },
        );
    },
    { scope: rootRef },
  );

  return (
    <section
      id="how-it-works"
      ref={rootRef}
      className="overflow-hidden border-b border-ink bg-paper"
    >
      <div className="mx-auto max-w-7xl px-4 pt-24 md:px-6 md:pt-32">
        <SectionHeading index="02 —" title="[ HOW IT WORKS ]" className="mb-12" />
      </div>

      {/* Desktop pinned horizontal rail */}
      <div className="relative hidden md:block">
        <div className="h-dvh overflow-hidden">
          <div className="flex h-full items-center pb-16">
            <div ref={carrierRef} className="flex gap-px bg-ink px-6">
              {STEPS.map((step, index) => (
                <article
                  key={step.stage}
                  className="flex w-[68vw] max-w-[880px] shrink-0 gap-0 border bg-paper lg:w-[52vw]"
                >
                  <div className="relative w-1/2 shrink-0 overflow-hidden">
                    <div data-step-visual className="relative z-10 size-full">
                      <Image
                        src={`https://picsum.photos/seed/${step.seed}/900/1200`}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 30vw, 50vw"
                        className="size-full object-cover grayscale contrast-125"
                      />
                    </div>
                    <span className="mono absolute bottom-3 left-3 z-20 bg-ink px-2 py-1 text-[10px] text-paper">
                      {step.stage}
                    </span>
                    <span className="mono absolute top-3 right-3 z-20 bg-hazard px-2 py-1 text-[10px] text-white">
                      {step.status}
                    </span>
                  </div>

                  <div className="flex w-1/2 flex-col justify-between p-8">
                    <div>
                      <p className="mono text-[10px] text-ink-40">MANIFEST / {`0${index + 1}`}</p>
                      <h3 className="display mt-4 text-4xl lg:text-5xl">{step.title}</h3>
                      <p className="mt-5 max-w-[36ch] text-sm leading-relaxed text-ink-80">
                        {step.body}
                      </p>
                    </div>
                    <p className="mono text-[10px] text-hazard">
                      {index < STEPS.length - 1 ? 'NEXT >>>' : 'FINAL STAGE'}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
        {/* progress rule */}
        <div className="absolute bottom-8 left-1/2 z-40 w-full max-w-md -translate-x-1/2">
          <div className="h-px w-full bg-ink/30" />
        </div>
      </div>

      {/* Mobile stacked fallback */}
      <div className="px-4 pb-24 md:hidden">
        <div className="grid grid-cols-1 gap-px border border-ink bg-ink">
          {STEPS.map((step) => (
            <article key={step.stage} className="bg-paper p-6">
              <p className="mono text-[10px] text-hazard">
                {step.stage} — {step.status}
              </p>
              <h3 className="display mt-2 text-2xl">{step.title}</h3>
              <p className="mt-2 text-sm text-ink-80">{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
