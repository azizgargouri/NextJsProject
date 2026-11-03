import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { requirePageUser } from '@/server/shared/auth/session';
import { claimsService } from '@/server/modules/claims';
import { reviewsRepository } from '@/server/modules/reviews';

export const metadata: Metadata = {
  title: 'Dashboard',
};

/**
 * Workspace home — a Server Component: it reads MongoDB directly (no API round-trip) and
 * ships ready HTML (SSR, course ch.2). Requests / quotes / tracking belong to other members.
 */
export default async function DashboardPage() {
  const user = await requirePageUser();
  const [claims, rating] = await Promise.all([
    claimsService.briefForActor(user),
    user.role === 'MOVER' ? reviewsRepository.summary(user.sub) : Promise.resolve(null),
  ]);
  const openClaims = claims.filter(
    (claim) => claim.status === 'OPEN' || claim.status === 'UNDER_REVIEW',
  ).length;

  const cells =
    user.role === 'CLIENT'
      ? [
          {
            href: '/dashboard/claims/new',
            title: 'Report an issue',
            meta: 'Open a claim about a move',
          },
          { href: '/dashboard/claims', title: 'My claims', meta: `${openClaims} in progress` },
          { href: '/dashboard/reviews', title: 'Rate a mover', meta: 'Share your experience' },
          { href: '/dashboard/assistant', title: 'Ask the assistant', meta: 'AI help, 24/7' },
        ]
      : [
          {
            href: '/dashboard/claims',
            title: 'Claims about me',
            meta: `${openClaims} in progress`,
          },
          {
            href: '/dashboard/reviews',
            title: 'My rating',
            meta: rating?.average
              ? `${rating.average}/5 · ${rating.count} reviews`
              : 'No reviews yet',
          },
          { href: '/dashboard/assistant', title: 'Ask the assistant', meta: 'AI help, 24/7' },
        ];

  return (
    <>
      <p className="mono text-[10px] text-hazard">{user.role} WORKSPACE</p>
      <h1 className="display mt-2 text-4xl md:text-6xl">
        HELLO, {user.name.split(' ')[0]?.toUpperCase()}.
      </h1>
      <p className="mono mt-4 text-[11px] text-ink-80">
        MOVE REQUESTS / QUOTES / TRACKING — DELIVERED BY THE REQUESTS MODULE.
      </p>
      <div className="mono mt-12 grid grid-cols-1 gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
        {cells.map((cell) => (
          <Link
            key={cell.href}
            href={cell.href}
            className="group bg-paper p-8 transition-colors hover:bg-ink hover:text-paper"
          >
            <ArrowUpRight className="size-5 text-hazard" />
            <p className="display mt-6 text-2xl">{cell.title}</p>
            <p className="mt-2 text-[10px] text-ink-40 group-hover:text-paper/70">{cell.meta}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
