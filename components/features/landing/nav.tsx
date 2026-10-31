'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const NAV_LINKS = [
  { label: 'Services', href: '/#services' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Coverage', href: '/#coverage' },
  { label: 'Movers', href: '/#become-mover' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useGSAP(
    () => {
      gsap.from('[data-nav-cell]', {
        yPercent: -100,
        autoAlpha: 0,
        duration: 0.7,
        stagger: 0.05,
        ease: 'power3.out',
      });
    },
    { scope: rootRef },
  );

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div ref={rootRef}>
      <nav
        className={cn(
          'fixed inset-x-0 top-0 z-50 border-b bg-paper/95 backdrop-blur transition-all',
          scrolled ? 'border-ink' : 'border-transparent',
        )}
      >
        <div className="mx-auto grid grid-cols-[auto_1fr_auto] grid-rows-1 max-w-7xl grid-flow-dense">
          {/* Brand cell */}
          <div data-nav-cell className="border-r border-ink px-4 py-3 md:px-6">
            <Link href="/" className="mono flex items-center gap-2 text-sm font-bold">
              <span className="inline-block size-2.5 bg-hazard" aria-hidden />
              MOVE<span className="text-hazard">UP</span>
            </Link>
          </div>

          {/* Desktop links */}
          <div data-nav-cell className="hidden items-stretch md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="mono flex items-center border-r border-ink/20 px-5 text-[11px] text-ink-80 hover:bg-ink hover:text-paper"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div data-nav-cell className="flex items-center gap-px px-4 py-2 md:px-0">
            <Link href="/sign-in" className="hidden sm:block">
              <Button variant="outline" size="sm" className="border-ink">
                Log in
              </Button>
            </Link>
            <Link href="/sign-up" className="hidden sm:block">
              <Button variant="hazard" size="sm">
                Request a move
              </Button>
            </Link>
            <button
              className="mono flex h-11 w-11 items-center justify-center border-2 border-ink md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label="Toggle navigation menu"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer with backdrop */}
      {mounted && open && (
        <>
          <div
            className="fixed inset-0 top-[57px] z-30 bg-ink/40 backdrop-blur-xs md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-x-0 top-[57px] z-40 border-b-2 border-ink bg-paper shadow-2xl md:hidden">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="mono block border-b border-ink/20 px-6 py-4 text-xs font-semibold hover:bg-ink hover:text-paper"
              >
                {link.label}
              </Link>
            ))}
            <div className="flex border-b border-ink/20">
              <Link
                href="/track"
                onClick={() => setOpen(false)}
                className="mono flex-1 border-r border-ink/20 px-6 py-4 text-xs text-ink-80 hover:bg-ink hover:text-paper"
              >
                TRACK A MOVE
              </Link>
            </div>
            <div className="flex gap-px bg-ink">
              <Link
                href="/sign-in"
                onClick={() => setOpen(false)}
                className="mono flex-1 bg-paper px-6 py-4 text-center text-xs font-bold"
              >
                LOG IN
              </Link>
              <Link
                href="/request"
                onClick={() => setOpen(false)}
                className="mono flex-1 bg-hazard px-6 py-4 text-center text-xs font-bold text-white hover:bg-hazard-dark"
              >
                REQUEST A MOVE
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
