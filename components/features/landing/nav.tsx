'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import {
  LANDING_LOCALES,
  LOCALE_COOKIE,
  type LandingLocale,
  type LandingMessages,
} from '@/lib/i18n/landing';
import { useLenis } from './smooth-scroll';

const SECTION_IDS = ['services', 'how-it-works', 'estimate', 'faq'] as const;

export function Nav({ t, locale }: { t: LandingMessages; locale: LandingLocale }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const lenis = useLenis();

  const links = [
    { id: 'services', label: t.nav.links.services },
    { id: 'how-it-works', label: t.nav.links.how },
    { id: 'estimate', label: t.nav.links.estimate },
    { id: 'faq', label: t.nav.links.faq },
  ];

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Current section for `aria-current`: the one crossing the upper third.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    for (const id of SECTION_IDS) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, []);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  }, []);

  // Drawer: Escape closes, focus moves in and stays in, the page stops scrolling.
  useEffect(() => {
    if (!open) return;
    lenis?.stop();
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    drawerRef.current?.querySelector<HTMLElement>('a, button')?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = [
        toggleRef.current,
        ...drawerRef.current.querySelectorAll<HTMLElement>('a, button'),
      ].filter(Boolean) as HTMLElement[];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = previousOverflow;
      lenis?.start();
    };
  }, [close, lenis, open]);

  const switchLocale = (next: LandingLocale) => {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  return (
    <div ref={rootRef}>
      <nav
        aria-label={t.nav.menu}
        className={cn(
          'fixed inset-x-0 top-0 z-50 border-b bg-paper/95 backdrop-blur-sm transition-colors duration-300',
          scrolled || open ? 'border-ink' : 'border-transparent',
        )}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-stretch">
          <div data-nav-cell className="flex items-center border-r border-ink px-4 md:px-6">
            <Link
              href="/"
              aria-label={t.nav.home}
              className="mono flex items-center gap-2 text-sm font-bold"
            >
              <span className="inline-block size-2.5 bg-hazard" aria-hidden />
              MOVE<span className="text-hazard-ink">UP</span>
            </Link>
          </div>

          <div data-nav-cell className="hidden flex-1 items-stretch md:flex">
            {links.map((link) => (
              <Link
                key={link.id}
                href={`/#${link.id}`}
                aria-current={active === link.id ? 'location' : undefined}
                className={cn(
                  'mono relative flex items-center border-r border-ink/15 px-5 text-[11px] transition-colors hover:bg-ink hover:text-paper',
                  active === link.id ? 'text-ink' : 'text-ink-80',
                )}
              >
                {link.label}
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-5 bottom-0 h-0.5 origin-left bg-hazard transition-transform duration-300',
                    active === link.id ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </Link>
            ))}
          </div>

          <div data-nav-cell className="ml-auto flex items-center gap-2 px-3 md:gap-3 md:px-4">
            <LocaleSwitch locale={locale} label={t.nav.language} onSwitch={switchLocale} />
            <Link
              href="/sign-in"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'hidden border-ink lg:inline-flex',
              )}
            >
              {t.nav.login}
            </Link>
            <Link
              href="/sign-up"
              className={cn(buttonVariants({ variant: 'hazard', size: 'sm' }), 'px-3 sm:px-4')}
            >
              <span className="sm:hidden">{t.nav.requestShort}</span>
              <span className="hidden sm:inline">{t.nav.request}</span>
            </Link>
            <button
              ref={toggleRef}
              type="button"
              className="flex size-10 items-center justify-center border border-ink md:hidden"
              onClick={() => (open ? close(false) : setOpen(true))}
              aria-expanded={open}
              aria-controls="landing-mobile-menu"
              aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </nav>

      {open ? (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="fixed inset-0 top-14 z-40 bg-ink/30 md:hidden"
            onClick={() => close()}
          />
          <div
            ref={drawerRef}
            id="landing-mobile-menu"
            className="fixed inset-x-0 top-14 z-40 border-b border-ink bg-paper md:hidden"
          >
            {links.map((link) => (
              <Link
                key={link.id}
                href={`/#${link.id}`}
                onClick={() => close(false)}
                className="mono flex min-h-14 items-center border-b border-ink/15 px-6 text-sm hover:bg-ink hover:text-paper"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/sign-in"
              onClick={() => close(false)}
              className="mono flex min-h-14 items-center px-6 text-sm hover:bg-ink hover:text-paper"
            >
              {t.nav.login}
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

function LocaleSwitch({
  locale,
  label,
  onSwitch,
}: {
  locale: LandingLocale;
  label: string;
  onSwitch: (locale: LandingLocale) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-9 border border-ink">
      {LANDING_LOCALES.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          lang={value}
          aria-checked={locale === value}
          aria-label={value === 'fr' ? 'Français' : 'English'}
          onClick={() => onSwitch(value)}
          className={cn(
            'mono flex min-w-9 items-center justify-center px-2 text-[11px] transition-colors',
            locale === value ? 'bg-ink text-paper' : 'text-ink-80 hover:bg-ink/10',
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
