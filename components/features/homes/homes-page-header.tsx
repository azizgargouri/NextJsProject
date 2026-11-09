import Link from 'next/link';
import type { ReactNode } from 'react';

interface HomesPageHeaderProps {
  trail: { label: string; href?: string }[];
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

/** Breadcrumb + display title + actions, in the dashboard's Swiss print voice. */
export function HomesPageHeader({ trail, title, description, actions }: HomesPageHeaderProps) {
  return (
    <header className="border-b border-ink pb-8">
      <nav aria-label="Breadcrumb" className="mono flex flex-wrap gap-2 text-[10px] text-ink-40">
        {trail.map((crumb, index) => (
          <span key={crumb.label} className="flex gap-2">
            {index > 0 && <span aria-hidden>/</span>}
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-hazard">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink-80">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>
      <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="display break-words text-4xl md:text-6xl">{title}</h1>
          {description && <p className="mt-4 max-w-2xl text-sm text-ink-80">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
      </div>
    </header>
  );
}
