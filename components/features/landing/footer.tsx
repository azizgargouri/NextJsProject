import Link from 'next/link';
import { fill, type LandingMessages } from '@/lib/i18n/landing';
import { LANDING_PHOTOS } from './photos';

/** Footer — real destinations only, plus attribution for every photograph. */
export function Footer({
  t,
  ruleVersion,
}: {
  t: LandingMessages['footer'];
  ruleVersion: number | null;
}) {
  const columns = [
    {
      title: t.service,
      links: [
        { label: t.links.request, href: '/sign-up' },
        { label: t.links.movers, href: '/sign-up?role=MOVER' },
        { label: t.links.coverage, href: '/#coverage' },
      ],
    },
    {
      title: t.help,
      links: [
        { label: t.links.estimate, href: '/#estimate' },
        { label: t.links.faq, href: '/#faq' },
        { label: t.links.login, href: '/sign-in' },
      ],
    },
    {
      title: t.contact,
      links: [{ label: 'hello@moveup.tn', href: 'mailto:hello@moveup.tn' }],
      note: t.city,
    },
  ];

  return (
    <footer className="on-ink bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="grid grid-cols-2 gap-10 border-b border-paper/20 pb-12 md:grid-cols-5">
          <div className="col-span-2">
            <p className="mono flex items-center gap-2 text-lg font-bold">
              <span className="inline-block size-2.5 bg-hazard" aria-hidden />
              MOVE<span className="text-hazard-glow">UP</span>
            </p>
            <p className="mt-4 max-w-[34ch] text-sm leading-relaxed text-paper/70">{t.tagline}</p>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="mono mb-4 text-[11px] text-hazard-glow">{column.title}</p>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-paper/80 underline-offset-4 hover:text-paper hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              {column.note ? <p className="mt-2 text-sm text-paper/60">{column.note}</p> : null}
            </nav>
          ))}
        </div>

        <details className="group border-b border-paper/20 py-5">
          <summary className="mono flex cursor-pointer list-none items-center justify-between text-[11px] text-paper/70 hover:text-paper">
            {t.credits}
            <span aria-hidden className="transition-transform duration-200 group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="mt-3 text-xs text-paper/60">{t.creditsNote}</p>
          <ul className="mt-3 grid gap-x-8 gap-y-1.5 text-xs text-paper/70 md:grid-cols-2">
            {Object.values(LANDING_PHOTOS).map((photo) => (
              <li key={photo.slug}>
                <a
                  href={photo.source}
                  className="underline-offset-2 hover:text-paper hover:underline"
                >
                  {photo.title}
                </a>{' '}
                · {photo.author} ·{' '}
                <a
                  href={photo.licenseUrl}
                  className="underline-offset-2 hover:text-paper hover:underline"
                >
                  {photo.license}
                </a>
              </li>
            ))}
          </ul>
        </details>

        <div className="mono flex flex-col items-start justify-between gap-2 pt-6 text-[11px] text-paper/60 md:flex-row md:items-center">
          <p>{fill(t.rights, { year: new Date().getFullYear() })}</p>
          {ruleVersion ? <p>{fill(t.ruleStatus, { version: ruleVersion })}</p> : null}
        </div>
      </div>
    </footer>
  );
}
