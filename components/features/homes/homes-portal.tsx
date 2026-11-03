'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Home, Plus, Search } from 'lucide-react';
import { buttonVariants, Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useHomes } from '@/hooks/content/homes';
import { HOME_LIMITS } from '@/types/homes';
import { apiErrorMessage, HOME_TYPE_LABELS } from './home-schemas';
import { HomesPageHeader } from './homes-page-header';

const PAGE_SIZE = 9;

/** /dashboard/homes — the client's saved new houses. */
export function HomesPortal() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const { data, isLoading, isError, error, refetch, isFetching } = useHomes({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
  });

  const homes = data?.data ?? [];
  const meta = data?.meta;
  const atLimit = !debouncedSearch && (meta?.itemCount ?? 0) >= HOME_LIMITS.homesPerClient;

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <HomesPageHeader
        trail={[{ label: 'Workspace', href: '/dashboard' }, { label: 'New houses' }]}
        title="My new house."
        description="Describe the rooms of the place you are moving to. The layout assistant uses these sizes to suggest where each of your items should go."
        actions={
          atLimit ? (
            <p className="mono text-[10px] text-ink-40">
              Limit reached ({HOME_LIMITS.homesPerClient} houses)
            </p>
          ) : (
            <Link href="/dashboard/homes/new" className={buttonVariants({ size: 'lg' })}>
              <Plus aria-hidden /> Add a house
            </Link>
          )
        }
      />

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-sm">
          <span className="sr-only">Search houses by name or city</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-40"
          />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name or city"
            className="pl-9"
          />
        </label>
        {meta && (
          <p className="mono text-[10px] text-ink-40" aria-live="polite">
            {isFetching ? 'Loading…' : `${meta.itemCount} house${meta.itemCount === 1 ? '' : 's'}`}
          </p>
        )}
      </div>

      <section aria-label="Houses" className="mt-6">
        {isLoading ? (
          <div className="grid grid-cols-1 pt-px pl-px md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="-mt-px -ml-px h-52 border border-ink bg-paper p-6">
                <div className="h-3 w-24 animate-pulse bg-paper-soft motion-reduce:animate-none" />
                <div className="mt-4 h-8 w-3/4 animate-pulse bg-paper-soft motion-reduce:animate-none" />
                <div className="mt-10 h-3 w-1/2 animate-pulse bg-paper-soft motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div role="alert" className="border border-hazard bg-hazard/5 p-6">
            <p className="mono text-[11px] text-hazard">
              {apiErrorMessage(error, 'Could not load your houses.')}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : homes.length === 0 ? (
          <div className="flex flex-col items-center border border-ink px-6 py-16 text-center">
            <Home aria-hidden className="size-10 text-ink-40" />
            <p className="display mt-6 text-3xl">
              {debouncedSearch ? 'No match.' : 'No house yet.'}
            </p>
            <p className="mt-3 max-w-md text-sm text-ink-80">
              {debouncedSearch
                ? `No house matches “${debouncedSearch}”.`
                : 'Add your new house and its rooms to get a placement plan for your furniture.'}
            </p>
            {!debouncedSearch && (
              <Link href="/dashboard/homes/new" className={buttonVariants({ className: 'mt-8' })}>
                <Plus aria-hidden /> Add a house
              </Link>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-1 pt-px pl-px md:grid-cols-2 lg:grid-cols-3">
            {homes.map((home) => (
              <li key={home.id} className="-mt-px -ml-px border border-ink bg-paper">
                <Link
                  href={`/dashboard/homes/${home.id}`}
                  className="group flex h-full flex-col p-6 transition-colors hover:bg-paper-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-hazard"
                >
                  <p className="mono text-[10px] text-ink-40">
                    {HOME_TYPE_LABELS[home.type]} · {home.city}
                  </p>
                  <p className="display mt-3 break-words text-3xl">{home.label}</p>
                  <dl className="mono mt-8 grid grid-cols-3 gap-px border border-ink bg-ink text-[10px]">
                    {[
                      ['Rooms', String(home.rooms.length)],
                      ['Area', `${home.totalAreaM2} m²`],
                      ['Floor', `${home.floor}${home.hasElevator ? ' · lift' : ''}`],
                    ].map(([term, value]) => (
                      <div key={term} className="bg-paper px-2 py-2">
                        <dt className="text-ink-40">{term}</dt>
                        <dd className="mt-1 text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mono mt-6 text-[11px] text-ink group-hover:text-hazard">
                    Open &gt;&gt;&gt;
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {meta && meta.pageCount > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasPreviousPage}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </Button>
          <p className="mono text-[10px] text-ink-80">
            Page {meta.page} / {meta.pageCount}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasNextPage}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </main>
  );
}
