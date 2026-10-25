'use client';

import { useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants, type ButtonProps } from '@/components/ui/button';

/**
 * Magnetic button — pulls subtly toward the cursor using gsap.quickTo()
 * (single reused tween per axis; no React state, no re-renders).
 */
export function MagneticButton({
  children,
  className,
  strength = 0.35,
  ...props
}: ButtonProps & { strength?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useGSAP(
    () => {
      const el = buttonRef.current;
      if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });

      const container = containerRef.current;
      if (!container) return;

      const onMove = (event: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        xTo((event.clientX - rect.left - rect.width / 2) * strength);
        yTo((event.clientY - rect.top - rect.height / 2) * strength);
      };

      const onLeave = () => {
        xTo(0);
        yTo(0);
      };

      container.addEventListener('mousemove', onMove);
      container.addEventListener('mouseleave', onLeave);
      return () => {
        container.removeEventListener('mousemove', onMove);
        container.removeEventListener('mouseleave', onLeave);
      };
    },
    { scope: containerRef },
  );

  return (
    <div ref={containerRef} className="inline-block">
      <Button ref={buttonRef} className={className} {...props}>
        {children}
      </Button>
    </div>
  );
}

/** Magnetic link variant for CTA anchors. */ export function MagneticLink({
  href,
  children,
  className,
  variant,
  size,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  variant?: NonNullable<ButtonProps['variant']>;
  size?: NonNullable<ButtonProps['size']>;
}) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  );
}
