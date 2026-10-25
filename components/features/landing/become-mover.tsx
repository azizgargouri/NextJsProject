'use client';

import { useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { MagneticButton } from '@/components/shared/magnetic-button';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Become-mover — Action block.
 * Dual-audience close: massive CTA for clients, crew-side application panel.
 */
export function BecomeMover() {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap.from('[data-cta-reveal]', {
        y: 40,
        autoAlpha: 0,
        duration: 0.9,
        stagger: 0.1,
        scrollTrigger: { trigger: rootRef.current, start: 'top 75%', once: true },
      });
    },
    { scope: rootRef },
  );

  return (
    <section id="become-mover" ref={rootRef} className="border-b border-ink bg-paper-soft">
      <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-16 md:px-6 md:pb-32">
        <p data-cta-reveal className="mono text-[10px] text-hazard">
          [ ACTION REQUIRED ]
        </p>
        <h2 data-cta-reveal className="display mt-4 max-w-4xl text-[clamp(2.5rem,6vw,5.5rem)]">
          READY WHEN YOU ARE.
        </h2>
        <p
          data-cta-reveal
          className="mt-6 max-w-[52ch] text-base leading-relaxed text-ink-80 md:text-lg"
        >
          Create an account, submit your move in under five minutes, and get your first quote from a
          vetted mover. Mobile-first, no calls, no vagueness, full history.
        </p>

        <div data-cta-reveal className="mt-10 flex flex-wrap items-center gap-6">
          <MagneticButton variant="primary" size="lg">
            <Link href="/sign-up">START MY REQUEST</Link>
          </MagneticButton>
          <MagneticButton variant="outline" size="lg" strength={0.25}>
            <Link href="/sign-up">{stringForMover()}</Link>
          </MagneticButton>
        </div>

        {/* Crew-side metrics ledger */}
        <div
          data-cta-reveal
          className="mt-20 grid grid-cols-1 gap-px border border-ink bg-ink md:grid-cols-3"
        >
          {[
            {
              code: 'CR-01',
              title: 'STEADY JOBS',
              body: 'Offers matched to your zone and availability calendar.',
            },
            {
              code: 'CR-02',
              title: 'CLEAR COMMISSION',
              body: 'Earnings listed per job, commission deducted in the open.',
            },
            {
              code: 'cr-03',
              title: 'VERIFIED IN 48H',
              body: 'Documents reviewed within two working days. ID, licence, insurance.',
            },
          ].map((cell) => (
            <div key={cell.code} className="bg-paper p-6 md:p-8">
              <p className="mono text-[10px] text-hazard">[{cell.code.toUpperCase()}]</p>
              <h3 className="display mt-2 text-2xl">{cell.title}</h3>
              <p className="mt-2 text-sm text-ink-80">{cell.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function stringForMover(): string {
  return 'I AM A MOVER >>>';
}
