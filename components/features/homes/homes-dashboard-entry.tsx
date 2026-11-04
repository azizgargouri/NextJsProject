'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { useHomes } from '@/hooks/content/homes';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { HOME_LIMITS } from '@/types/homes';

/**
 * Smart Room Layout entry on the client workspace (self-contained so the
 * dashboard page only needs one line). Renders nothing for non-CLIENT roles,
 * which the /api/homes routes would refuse anyway.
 */
export function HomesDashboardEntry() {
  const role = useAuthStore((state) => state.user?.role);
  return role === 'CLIENT' ? <ClientHomesEntry /> : null;
}

function ClientHomesEntry() {
  const { data, isLoading, isError } = useHomes({ page: 1, limit: 3 });
  const recent = data?.data ?? [];
  const total = data?.meta.itemCount ?? 0;
  const canAdd = total < HOME_LIMITS.homesPerClient;

  return (
    <section
      aria-labelledby="homes-entry-title"
      className="border border-t-0 border-ink bg-paper p-8 md:flex md:items-start md:justify-between md:gap-10"
    >
      <div className="min-w-0">
        <p className="mono flex items-center gap-2 text-[10px] text-hazard">
          <span className="inline-block size-2 bg-hazard" aria-hidden /> Live · Smart room layout
        </p>
        <h2 id="homes-entry-title" className="display mt-3 text-3xl md:text-4xl">
          My new house.
        </h2>
        <p className="mt-3 max-w-xl text-sm text-ink-80">
          Save the rooms of the place you are moving to. The layout assistant will suggest where
          each of your items goes.
        </p>

        {!isLoading && !isError && recent.length > 0 && (
          <ul className="mono mt-6 max-w-xl border-t border-ink text-[11px]">
            {recent.map((home) => (
              <li key={home.id} className="border-b border-ink">
                <Link
                  href={`/dashboard/homes/${home.id}`}
                  className="flex items-center justify-between gap-4 py-3 hover:text-hazard focus-visible:outline-2 focus-visible:outline-hazard"
                >
                  <span className="truncate">
                    {home.label} · {home.city}
                  </span>
                  <span className="shrink-0 text-ink-40">
                    {home.rooms.length} room{home.rooms.length === 1 ? '' : 's'} &gt;&gt;&gt;
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mono mt-4 text-[10px] text-ink-40" aria-live="polite">
          {isLoading
            ? 'Loading your houses…'
            : isError
              ? 'Could not load your houses right now.'
              : `${total} house${total === 1 ? '' : 's'} saved`}
        </p>
      </div>

      <div className="mt-8 flex shrink-0 flex-wrap gap-3 md:mt-0 md:flex-col">
        {canAdd && (
          <Link href="/dashboard/homes/new" className={buttonVariants()}>
            <Plus aria-hidden /> Add a house
          </Link>
        )}
        <Link href="/dashboard/homes" className={buttonVariants({ variant: 'outline' })}>
          My houses &gt;&gt;&gt;
        </Link>
      </div>
    </section>
  );
}
