'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useAdminShell } from './admin-shell-context';

export function AdminPageHeader() {
  const { page } = useAdminShell();
  if (!page) return null;

  return (
    <section className="shrink-0 border-b border-border bg-background px-4 py-5 min-[426px]:px-10">
      {page.breadcrumbs.length ? (
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex items-center gap-1 text-xs text-muted-foreground"
        >
          {page.breadcrumbs.map((item, index) => (
            <span key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight className="size-3" aria-hidden /> : null}
              {item.href ? (
                <Link
                  href={item.href}
                  className="rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-[-0.02em] md:text-2xl">{page.title}</h1>
          {page.description ? (
            <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
              {page.description}
            </p>
          ) : null}
        </div>
        {page.actions ? (
          <div className="flex shrink-0 items-center gap-2">{page.actions}</div>
        ) : null}
      </div>
    </section>
  );
}
