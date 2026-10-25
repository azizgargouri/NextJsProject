import Link from 'next/link';

const FOOTER_COLS = [
  {
    title: 'SERVICE',
    links: [
      { label: 'Request a move', href: '/sign-up' },
      { label: 'Become a mover', href: '/#become-mover' },
      { label: 'Coverage', href: '/#coverage' },
    ],
  },
  {
    title: 'LEGAL',
    links: [
      { label: 'Terms of service', href: '/#coverage' },
      { label: 'Privacy policy', href: '/#coverage' },
      { label: 'FAQ', href: '/#coverage' },
    ],
  },
  {
    title: 'CONTACT',
    links: [
      { label: 'hello@moveup.tn', href: 'mailto:hello@moveup.tn' },
      { label: 'Tunis, Tunisia', href: '/#coverage' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="grid grid-cols-2 gap-10 border-b border-paper/20 pb-12 md:grid-cols-5">
          <div className="col-span-2 md:col-span-2">
            <p className="mono flex items-center gap-2 text-lg font-bold">
              <span className="inline-block size-2.5 bg-hazard" aria-hidden />
              MOVE<span className="text-hazard">UP</span>
            </p>
            <p className="mt-4 max-w-[32ch] text-sm leading-relaxed text-paper/60">
              One request, vetted movers, a tracked move. Serving Tunisia&apos;s main corridors
              since 2024.
            </p>
          </div>

          {FOOTER_COLS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="mono mb-4 text-[10px] text-hazard">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-paper/70 hover:text-paper hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mono flex flex-col items-start justify-between gap-2 pt-6 text-[10px] text-paper/40 md:flex-row md:items-center">
          <p>© 2026 MOVEUP — TUNIS / SFAX / SOUSSE. ALL RIGHTS RESERVED.</p>
          <p>SYS STATUS: OPERATIONAL // REV 2.6</p>
        </div>
      </div>
    </footer>
  );
}
