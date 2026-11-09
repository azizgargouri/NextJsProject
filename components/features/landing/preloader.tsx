'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { LandingLocale, LandingMessages } from '@/lib/i18n/landing';
import { useLenis } from './smooth-scroll';

const SEEN_KEY = 'moveup_preloaded';
const DONE_EVENT = 'moveup:preloaded';
/** Shortest count, so the stages can be read on a fast load. */
const MIN_COUNT_MS = 900;
/** Longest count: a stalled network never keeps anyone out. */
const MAX_COUNT_MS = 4000;
const SLATS = 6;

declare global {
  interface Window {
    __moveupPreloaded?: boolean;
  }
}

/**
 * Runs `callback` once the preloader has lifted (immediately when there is
 * none: repeat visit, deep link, reduced motion). Returns an unsubscribe.
 */
export function whenPreloaded(callback: () => void): () => void {
  if (window.__moveupPreloaded) {
    callback();
    return () => {};
  }
  window.addEventListener(DONE_EVENT, callback, { once: true });
  return () => window.removeEventListener(DONE_EVENT, callback);
}

function finish() {
  if (window.__moveupPreloaded) return;
  window.__moveupPreloaded = true;
  window.dispatchEvent(new Event(DONE_EVENT));
}

/**
 * Inline, pre-paint. Marks the document as scripted (the preloader only ever
 * shows when JavaScript runs), and as already preloaded on repeat visits or
 * deep links (`/#estimate` goes straight to its section), so CSS settles the
 * first frame with no flash.
 */
export const PRELOADER_BOOT_SCRIPT = `(function(d){d.dataset.js='1';try{if(sessionStorage.getItem('${SEEN_KEY}')==='1'||location.hash.length>1)d.dataset.preloaded='1'}catch(e){}})(document.documentElement)`;

function shouldSkip(): boolean {
  return (
    document.documentElement.dataset.preloaded === '1' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Preloader — the truck's roller door.
 *   1. entrance: brand, the six move stages (in real move order), the label
 *      and the counter rise in one at a time from behind masks;
 *   2. count: the counter follows real loading only (fonts, the photos marked
 *      `data-preload`), never ahead of it, and ticks the stages in order;
 *   3. lift: the content leaves line by line, then the door rolls up as one
 *      sheet into its drum and the hero starts underneath.
 * Esc, a click or a tap skips straight to the lift. The page behind is inert
 * while the door is down.
 */
export function Preloader({
  t,
  locale,
}: {
  t: LandingMessages['preloader'];
  locale: LandingLocale;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(true);
  const lenis = useLenis();

  useLayoutEffect(() => {
    if (shouldSkip()) {
      setActive(false);
      finish();
      return;
    }

    const root = rootRef.current;
    if (!root) return;
    const html = document.documentElement;
    const behind = Array.from(document.querySelectorAll<HTMLElement>('[data-preloader-behind]'));
    html.style.overflow = 'hidden';
    behind.forEach((element) => (element.inert = true));
    const release = () => {
      html.style.overflow = '';
      behind.forEach((element) => (element.inert = false));
    };

    // Real progress: web fonts plus the photos the first viewport depends on.
    let loaded = 0;
    const tasks: Promise<unknown>[] = [
      document.fonts.ready,
      ...Array.from(document.querySelectorAll<HTMLImageElement>('img[data-preload]')).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            }),
      ),
    ];
    tasks.forEach((task) => void task.then(() => (loaded += 1)));

    const stageItems = Array.from(root.querySelectorAll<HTMLElement>('[data-stage]'));
    let lifting = false;
    let onTick: (() => void) | null = null;

    const ctx = gsap.context(() => {
      const rise = { y: '0%', duration: 0.7, ease: 'expo.out' };
      gsap
        .timeline()
        .fromTo('[data-rise="brand"]', { y: '110%' }, { ...rise, stagger: 0.05 })
        .fromTo('[data-rise="stage"]', { y: '110%' }, { ...rise, stagger: 0.04 }, '-=0.5')
        .fromTo('[data-rise="label"]', { y: '110%' }, rise, '-=0.55')
        .fromTo('[data-rise="count"]', { y: '110%' }, { ...rise, duration: 0.9 }, '<')
        .fromTo(
          '[data-rail]',
          { scaleX: 0 },
          { scaleX: 1, duration: 0.7, ease: 'expo.inOut', transformOrigin: 'left center' },
          '<',
        );

      // Counting overlaps the entrance: the first stage can tick as the counter lands.
      const started = performance.now() + 250;
      const state = { p: 0 };
      let shown = -1;
      onTick = () => {
        const elapsed = performance.now() - started;
        if (elapsed < 0) return;
        const timeShare = Math.min(1, elapsed / MIN_COUNT_MS);
        const loadShare = loaded / tasks.length;
        // Never ahead of real loading; the time floor only paces a fast load.
        const target = elapsed >= MAX_COUNT_MS ? 1 : Math.min(timeShare, loadShare);
        const gap = target - state.p;
        state.p = Math.min(target, state.p + Math.min(0.045, Math.max(gap * 0.16, 0.006)));

        const pct = Math.floor(state.p * 100);
        if (pct !== shown) {
          shown = pct;
          if (countRef.current) countRef.current.textContent = String(pct).padStart(3, '0');
          const done = Math.floor((pct / 100) * stageItems.length);
          stageItems.forEach((item, index) => item.toggleAttribute('data-done', index < done));
        }
        if (barRef.current) barRef.current.style.transform = `scaleX(${state.p})`;
        if (state.p >= 1) lift(false);
      };
      gsap.ticker.add(onTick);
    }, root);

    function lift(skipped: boolean) {
      if (lifting) return;
      lifting = true;
      if (onTick) gsap.ticker.remove(onTick);
      stageItems.forEach((item) => item.setAttribute('data-done', ''));
      try {
        sessionStorage.setItem(SEEN_KEY, '1');
      } catch {}

      ctx.add(() => {
        const leave = { y: '-110%', duration: 0.45, ease: 'power3.in' };
        const tl = gsap.timeline({
          onComplete: () => {
            release();
            setActive(false);
          },
        });
        tl.to('[data-rise="count"]', leave)
          .to('[data-rise="stage"]', { ...leave, stagger: 0.03 }, '<0.05')
          .to('[data-rise="label"], [data-rise="brand"]', { ...leave, stagger: 0.04 }, '<0.1')
          .to(
            '[data-rail]',
            { scaleX: 0, duration: 0.5, ease: 'expo.inOut', transformOrigin: 'right center' },
            '<',
          )
          // The seams appear as the door starts to move: it reads as slats only in motion.
          .to('[data-seam]', { opacity: 1, duration: 0.25, ease: 'none' }, '-=0.2')
          .addLabel('door', '<')
          // One rigid sheet rolls up into the drum, like a truck's rear shutter.
          .to('[data-door]', { yPercent: -100, duration: 1, ease: 'power3.inOut' }, 'door')
          .to('[data-drum]', { yPercent: -100, duration: 0.35, ease: 'power2.in' }, '>-0.1')
          // The hero starts while the door is still rising: one continuous move.
          .call(finish, [], 'door+=0.4');
        if (skipped) tl.timeScale(1.6);
      });
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') lift(true);
    };
    const onPointer = () => lift(true);
    window.addEventListener('keydown', onKey);
    root.addEventListener('pointerdown', onPointer);

    return () => {
      window.removeEventListener('keydown', onKey);
      root.removeEventListener('pointerdown', onPointer);
      if (onTick) gsap.ticker.remove(onTick);
      ctx.revert();
      release();
    };
  }, []);

  // Lenis scrolls on its own wheel handling; hold it while the door is down.
  useEffect(() => {
    if (!lenis) return;
    if (active) lenis.stop();
    else lenis.start();
  }, [lenis, active]);

  if (!active) return null;

  return (
    <div
      ref={rootRef}
      lang={locale}
      aria-hidden
      className="preloader fixed inset-0 z-[100] cursor-pointer overflow-hidden"
    >
      {/* The door: one sheet of slats, with its drum at the top */}
      <div data-door className="absolute inset-0 flex flex-col will-change-transform">
        {Array.from({ length: SLATS }, (_, index) => (
          <span key={index} className="relative block flex-1 bg-ink">
            {index < SLATS - 1 ? (
              <span data-seam className="absolute inset-x-0 bottom-0 h-px bg-paper/15 opacity-0" />
            ) : null}
          </span>
        ))}
        {/* Bottom rail of the shutter, with its handle */}
        <span className="absolute inset-x-0 bottom-0 h-2 border-t border-paper/20 bg-ink">
          <span className="absolute bottom-0 left-1/2 h-1 w-16 -translate-x-1/2 bg-hazard" />
        </span>
      </div>
      <span
        data-drum
        className="absolute inset-x-0 top-0 z-10 h-2.5 border-b-2 border-hazard bg-ink"
      />

      <div className="relative mx-auto flex h-full w-full max-w-7xl flex-col justify-between px-4 pb-8 pt-7 text-paper md:px-6 md:pb-10 md:pt-8">
        <div className="mono flex items-start justify-between gap-6 text-[11px] text-paper/70">
          <Mask className="shrink-0">
            <p data-rise="brand" className="flex items-center gap-2 text-sm font-bold text-paper">
              <span className="inline-block size-2.5 shrink-0 bg-hazard" />
              <span>
                MOVE<span className="text-hazard-glow">UP</span>
              </span>
            </p>
          </Mask>
          <Mask>
            <p data-rise="brand" className="text-right">
              TUNIS · SFAX · SOUSSE
              <br />
              <span className="text-paper/60">{t.skip}</span>
            </p>
          </Mask>
        </div>

        <div>
          <ol className="mono mb-8 grid grid-cols-1 gap-y-2.5 text-[11px] sm:mb-10 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-6">
            {t.stages.map((stage, index) => (
              <li key={stage} className="overflow-hidden">
                <span
                  data-rise="stage"
                  data-stage
                  className="group flex items-center gap-2 text-paper/60 transition-colors duration-200 data-done:text-paper"
                >
                  <span className="w-5 tabular-nums text-paper/60">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="grid size-3.5 shrink-0 place-items-center border border-paper/60 transition-colors duration-200 group-data-done:border-hazard group-data-done:bg-hazard">
                    <svg
                      viewBox="0 0 10 10"
                      className="size-2.5 scale-50 opacity-0 transition duration-200 group-data-done:scale-100 group-data-done:opacity-100"
                    >
                      <path
                        d="M2 5.2 4.1 7.3 8 3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                    </svg>
                  </span>
                  {stage}
                </span>
              </li>
            ))}
          </ol>

          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div className="sm:pb-3">
              <Mask>
                <p data-rise="label" className="mono max-w-[30ch] text-[11px] text-paper/70">
                  {t.label}
                </p>
              </Mask>
            </div>
            <Mask className="shrink-0 self-end">
              <p data-rise="count" className="display flex items-start leading-[0.8] tabular-nums">
                <span ref={countRef} className="text-[clamp(5rem,26vw,17rem)]">
                  000
                </span>
                <span className="mono ml-1 mt-1 text-xl text-hazard-glow md:mt-3 md:text-3xl">
                  %
                </span>
              </p>
            </Mask>
          </div>

          <div data-rail className="mt-6 h-[3px] w-full bg-paper/15">
            <span
              ref={barRef}
              className="block h-full w-full origin-left bg-hazard"
              style={{ transform: 'scaleX(0)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Clips a line so it can rise in from below and leave through the top. */
function Mask({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-hidden ${className}`}>{children}</div>;
}
