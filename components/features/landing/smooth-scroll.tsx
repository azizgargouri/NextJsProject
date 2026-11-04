'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const NAV_OFFSET = -64;

const LenisContext = createContext<Lenis | null>(null);

/** The page's Lenis instance, or null when smooth scroll is off (reduced motion). */
export function useLenis(): Lenis | null {
  return useContext(LenisContext);
}

/**
 * Smooth scroll for the public landing only. Lenis is driven by GSAP's ticker
 * so ScrollTrigger pins and scrubs read the same scroll position every frame.
 * Under `prefers-reduced-motion` native scrolling is kept untouched.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return;

    const instance = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Touch keeps native momentum: smoothing it fights the OS and feels laggy.
      syncTouch: false,
    });

    instance.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    setLenis(instance);

    // Same-page anchors glide instead of jumping, and clear the fixed nav.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
      const anchor = (event.target as Element | null)?.closest('a[href]');
      if (!anchor) return;
      const url = new URL((anchor as HTMLAnchorElement).href, window.location.href);
      if (url.pathname !== window.location.pathname || !url.hash) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      event.preventDefault();
      instance.scrollTo(target, { offset: NAV_OFFSET });
      history.replaceState(null, '', url.hash);
      target.focus({ preventScroll: true });
    };
    document.addEventListener('click', onClick);

    // Reduced motion switched on mid-session: hand scrolling back to the browser.
    const onPreference = () => {
      if (media.matches) instance.destroy();
    };
    media.addEventListener('change', onPreference);

    return () => {
      document.removeEventListener('click', onClick);
      media.removeEventListener('change', onPreference);
      gsap.ticker.remove(tick);
      instance.destroy();
      setLenis(null);
    };
  }, []);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
