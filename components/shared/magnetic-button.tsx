'use client';

import { useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { cn } from '@/lib/utils';
import { buttonVariants, type ButtonProps } from '@/components/ui/button';

/**
 * Magnetic link — a real anchor (one tab stop, correct semantics) that pulls
 * toward the cursor with gsap.quickTo. Inert under reduced motion and on touch.
 */
export function MagneticLink({
  href,
  children,
  className,
  variant,
  size,
  strength = 0.3,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  variant?: NonNullable<ButtonProps['variant']>;
  size?: NonNullable<ButtonProps['size']>;
  strength?: number;
}) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);

  useGSAP(
    () => {
      const zone = zoneRef.current;
      const link = linkRef.current;
      const fine = window.matchMedia('(pointer: fine)').matches;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!zone || !link || !fine || reduce) return;

      const xTo = gsap.quickTo(link, 'x', { duration: 0.45, ease: 'power3' });
      const yTo = gsap.quickTo(link, 'y', { duration: 0.45, ease: 'power3' });
      const onMove = (event: PointerEvent) => {
        const rect = zone.getBoundingClientRect();
        xTo((event.clientX - rect.left - rect.width / 2) * strength);
        yTo((event.clientY - rect.top - rect.height / 2) * strength);
      };
      const onLeave = () => {
        xTo(0);
        yTo(0);
      };
      zone.addEventListener('pointermove', onMove);
      zone.addEventListener('pointerleave', onLeave);
      return () => {
        zone.removeEventListener('pointermove', onMove);
        zone.removeEventListener('pointerleave', onLeave);
      };
    },
    { scope: zoneRef },
  );

  return (
    <div ref={zoneRef} className="inline-block p-3 -m-3">
      <Link ref={linkRef} href={href} className={cn(buttonVariants({ variant, size }), className)}>
        {children}
      </Link>
    </div>
  );
}
