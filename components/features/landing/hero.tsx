'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Hero — Attention block.
 * Editorial asymmetry: macro display type (2 lines max), telemetry margin
 * columns, full-width image strip that scales in on load and drifts on scroll.
 */
export function Hero() {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) return;

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Char-split reveal for the display line (no SplitText needed).
      const chars = rootRef.current?.querySelectorAll('[data-hero-char]');
      if (chars) {
        tl.from(chars, {
          yPercent: 110,
          autoAlpha: 0,
          duration: 0.9,
          stagger: { each: 0.018, from: 'start' },
          ease: 'power4.out',
        });
      }

      tl.from('[data-hero-fade]', { y: 26, autoAlpha: 0, duration: 0.8, stagger: 0.09 }, '-=0.45');

      tl.from(
        '[data-hero-strip]',
        { scaleY: 0.2, transformOrigin: 'bottom center', duration: 1.1, ease: 'expo.out' },
        '-=0.6',
      );

      gsap.to('[data-hero-strip] img', {
        scale: 1.12,
        ease: 'none',
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
    },
    { scope: rootRef },
  );

  const line1 = 'EVERY MOVE';
  const line2 = 'ON THE RECORD.';

  return (
    <section
      ref={rootRef}
      className="dotgrid relative flex min-h-dvh flex-col justify-end overflow-hidden border-b border-ink pt-24"
    >
      {/* Telemetry margin — top */}
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div
          className="flex items-start justify-between border-b border-ink/20 pb-3"
          data-hero-fade
        >
          <p className="mono text-[10px] text-ink-80">
            N 36.8065° — E 10.1815°
            <br />
            TUNIS SFAX SOUSSE
          </p>
          <p className="mono text-[10px] text-right text-ink-80">
            SOC-REG / TN-2026-0119
            <br />
            ROLE: CLIENT / MOVER / ADMIN
          </p>
        </div>
      </div>

      {/* Display type */}
      <div className="mx-auto w-full max-w-7xl px-4 py-16 md:px-6 md:py-24">
        <h1 className="display max-w-6xl text-[clamp(2.3rem,8.5vw,7.5rem)] text-ink">
          <span className="block overflow-hidden">
            {(line1 + ' ').split('').map((char, index) => (
              <span key={`a-${index}`} data-hero-char className="inline-block whitespace-pre">
                {char}
              </span>
            ))}
          </span>
          <span className="block overflow-hidden text-hazard">
            {line2.split('').map((char, index) => (
              <span key={`b-${index}`} data-hero-char className="inline-block whitespace-pre">
                {char}
              </span>
            ))}
          </span>
        </h1>

        <p
          data-hero-fade
          className="mt-8 max-w-[46ch] text-base leading-relaxed text-ink-80 md:text-lg"
        >
          One request. Vetted movers. A tracked timeline from quote to keys on the table. MoveUp
          lets you request a move in under five minutes and watch it happen — with a full record of
          every address, price and status change.
        </p>

        <div data-hero-fade className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/request"
            className="mono inline-flex h-14 items-center bg-hazard px-8 text-xs text-white transition-colors hover:bg-ink hover:text-paper"
          >
            REQUEST A MOVE &gt;&gt;&gt;
          </Link>
          <Link
            href="/#how-it-works"
            className="mono border-b-2 border-ink pb-1 text-[11px] text-ink hover:border-hazard hover:text-hazard"
          >
            SEE HOW IT WORKS
          </Link>
        </div>
      </div>

      {/* Full-bleed image strip (drifts on scroll) */}
      <div
        data-hero-strip
        className="relative h-[38dvh] w-full overflow-hidden border-t-2 border-ink md:h-[46dvh]"
      >
        <Image
          src="https://picsum.photos/seed/moveup-van/1920/1080"
          alt="Moving truck loaded with furniture, monochrome"
          fill
          priority
          sizes="100vw"
          className="size-full object-cover opacity-90 contrast-125 grayscale"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-paper/0 to-paper/20" aria-hidden />
        <span className="mono absolute bottom-3 left-4 text-[10px] text-white mix-blend-difference">
          FIG.01 — UNIT IN TRANSIT
        </span>
        <span className="mono absolute bottom-3 right-4 text-[10px] text-white mix-blend-difference">
          REV 2.6
        </span>
      </div>
    </section>
  );
}
