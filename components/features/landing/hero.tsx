'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { fill, type LandingMessages } from '@/lib/i18n/landing';
import { LANDING_PHOTOS } from './photos';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export interface HeroCopy {
  titleLine1: string;
  titleLine2: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
}

export interface PublicRule {
  name: string;
  version: number;
  minQuote: number;
}

/**
 * Hero — Attention. Macro display type set word by word (so a line can only
 * break between words), real pricing telemetry in the margins, and a photo
 * strip that wipes open on load and drifts with the scroll.
 */
export function Hero({
  copy,
  t,
  rule,
  minLabel,
}: {
  copy: HeroCopy;
  t: LandingMessages;
  rule: PublicRule | null;
  minLabel: string | null;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const photo = LANDING_PHOTOS['hero-piano'];

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.from('[data-hero-char]', {
        yPercent: 105,
        duration: 1.1,
        stagger: { each: 0.022 },
      })
        .from('[data-hero-fade]', { y: 24, autoAlpha: 0, duration: 0.9, stagger: 0.08 }, '-=0.75')
        .fromTo(
          '[data-hero-strip]',
          { clipPath: 'inset(100% 0% 0% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut' },
          '-=0.9',
        )
        .from('[data-hero-strip] img', { scale: 1.25, duration: 1.8 }, '<');

      gsap.to('[data-hero-photo]', {
        yPercent: 12,
        ease: 'none',
        scrollTrigger: {
          trigger: '[data-hero-strip]',
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });
    },
    { scope: rootRef },
  );

  const words = (line: string) => line.split(/\s+/).filter(Boolean);
  const title = `${copy.titleLine1} ${copy.titleLine2}`;

  return (
    <section
      ref={rootRef}
      className="dotgrid relative flex min-h-dvh flex-col justify-end overflow-hidden border-b border-ink pt-20"
    >
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div
          className="mono flex items-start justify-between gap-6 border-b border-ink/20 pb-3 text-[11px] text-ink-80"
          data-hero-fade
        >
          <p>
            N 36.8065° · E 10.1815°
            <br />
            {t.hero.cities}
          </p>
          <p className="text-right">
            {rule && minLabel ? (
              <>
                {fill(t.hero.estimateFrom, { min: minLabel })}
                <br />
                <span className="hidden sm:inline">
                  {fill(t.hero.rule, { name: rule.name.toUpperCase(), version: rule.version })}
                </span>
              </>
            ) : (
              t.hero.noRule
            )}
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-14 md:px-6 md:py-20">
        <h1
          aria-label={title}
          className="display max-w-6xl text-[clamp(2.6rem,9vw,6rem)] text-ink [overflow-wrap:normal]"
        >
          {[copy.titleLine1, copy.titleLine2].map((line, lineIndex) => (
            <span
              key={lineIndex}
              aria-hidden
              className={lineIndex === 1 ? 'block text-hazard' : 'block'}
            >
              {words(line).map((word, wordIndex) => (
                <span
                  key={wordIndex}
                  className="-mt-[0.2em] inline-block overflow-hidden whitespace-nowrap pb-[0.06em] pt-[0.2em] align-top"
                >
                  {word.split('').map((char, charIndex) => (
                    <span key={charIndex} data-hero-char className="inline-block">
                      {char}
                    </span>
                  ))}
                  {wordIndex < words(line).length - 1 ? (
                    <span className="inline-block">&nbsp;</span>
                  ) : null}
                </span>
              ))}
            </span>
          ))}
        </h1>

        <p
          data-hero-fade
          className="mt-8 max-w-[52ch] text-base leading-relaxed text-ink-80 md:text-lg"
        >
          {copy.subtitle}
        </p>

        <div data-hero-fade className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link
            href="/sign-up"
            className="mono inline-flex h-14 items-center bg-hazard px-8 text-xs text-white transition-colors duration-200 hover:bg-ink"
          >
            {copy.primaryCta}
          </Link>
          <Link
            href="/#how-it-works"
            className="mono inline-flex min-h-11 items-center border-b-2 border-ink text-xs text-ink transition-colors hover:border-hazard hover:text-hazard-ink"
          >
            {copy.secondaryCta}
          </Link>
        </div>
      </div>

      <figure
        data-hero-strip
        className="relative h-[42dvh] w-full overflow-hidden border-t-2 border-ink md:h-[50dvh]"
      >
        <div data-hero-photo className="absolute inset-x-0 -top-[12%] h-[124%]">
          <Image
            src={photo.src}
            alt={t.hero.photoAlt}
            fill
            priority
            sizes="100vw"
            className="object-cover object-[50%_35%] contrast-125 grayscale"
          />
        </div>
        <figcaption className="mono absolute bottom-3 left-4 bg-ink px-2 py-1 text-[11px] text-paper">
          {t.hero.figure}
        </figcaption>
      </figure>
    </section>
  );
}
