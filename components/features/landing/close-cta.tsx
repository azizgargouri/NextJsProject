'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { MagneticLink } from '@/components/shared/magnetic-button';
import type { LandingMessages } from '@/lib/i18n/landing';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/** Close — Action. The client's last screen: one CTA and a human to write to. */
export function CloseCta({ t }: { t: LandingMessages['close'] }) {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap.from('[data-close-char]', {
        yPercent: 110,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.03,
        scrollTrigger: { trigger: rootRef.current, start: 'top 70%', once: true },
      });
      gsap.from('[data-close-fade]', {
        y: 24,
        autoAlpha: 0,
        duration: 0.9,
        ease: 'expo.out',
        stagger: 0.08,
        delay: 0.3,
        scrollTrigger: { trigger: rootRef.current, start: 'top 70%', once: true },
      });
    },
    { scope: rootRef, dependencies: [t.title], revertOnUpdate: true },
  );

  const words = t.title.split(/\s+/).filter(Boolean);

  return (
    <section
      ref={rootRef}
      aria-labelledby="close-title"
      className="dotgrid border-b border-ink bg-paper-soft"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-28 md:px-6 md:py-40">
        <p data-close-fade className="mono text-[11px] text-hazard-ink">
          {t.kicker}
        </p>
        <h2
          id="close-title"
          aria-label={t.title}
          className="display mt-5 max-w-5xl text-[clamp(2.75rem,8vw,6rem)]"
        >
          {words.map((word, wordIndex) => (
            <span key={wordIndex} aria-hidden>
              <span className="-mt-[0.2em] inline-block overflow-hidden whitespace-nowrap pb-[0.06em] pt-[0.2em] align-top">
                {word.split('').map((char, charIndex) => (
                  <span key={charIndex} data-close-char className="inline-block">
                    {char}
                  </span>
                ))}
              </span>
              {wordIndex < words.length - 1 ? ' ' : null}
            </span>
          ))}
        </h2>
        <p
          data-close-fade
          className="mt-8 max-w-[52ch] text-base leading-relaxed text-ink-80 md:text-lg"
        >
          {t.body}
        </p>
        <div data-close-fade className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
          <MagneticLink href="/sign-up" variant="hazard" size="lg">
            {t.cta}
          </MagneticLink>
          <p className="text-sm text-ink-80">
            {t.contact}{' '}
            <a
              href="mailto:hello@moveup.tn"
              className="font-semibold text-ink underline decoration-hazard decoration-2 underline-offset-4 hover:text-hazard-ink"
            >
              hello@moveup.tn
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
