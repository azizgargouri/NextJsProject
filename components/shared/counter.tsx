'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

/**
 * Counter — animates innerText once when scrolled into view.
 * Format is delegated to the caller via `format`.
 */
export function Counter({
  value,
  format = (v) => Math.round(v).toString(),
  className,
  duration = 1.6,
}: {
  value: number;
  format?: (value: number) => string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        if (el) el.textContent = format(value);
        return;
      }

      const counter = { current: 0 };
      gsap.to(counter, {
        current: value,
        duration,
        ease: 'power2.out',
        onUpdate: () => {
          if (el) el.textContent = format(counter.current);
        },
      });
    },
    { scope: ref },
  );

  return (
    <span ref={ref} className={className}>
      0
    </span>
  );
}
