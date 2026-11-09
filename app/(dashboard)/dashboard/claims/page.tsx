import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePageUser } from '@/server/shared/auth/session';
import { ClaimPartyQuerySchema, claimsService } from '@/server/modules/claims';
import {
  CLAIM_CATEGORY_LABELS,
  CLAIM_STATUSES,
  CLAIM_STATUS_LABELS,
} from '@/lib/quality/constants';
import { buttonVariants } from '@/components/ui/button';
import {
  ClaimStamp,
  EmptyBlock,
  PageTitle,
  formatDate,
} from '@/components/features/workspace/workspace-blocks';
import { cn } from '@/lib/utils';
import { qualityBase } from '@/lib/quality/paths';

export const metadata: Metadata = { title: 'Claims' };

/** Server-rendered list; the status filter is a plain link (?status=OPEN) — no client state needed. */
export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await requirePageUser();
  const query = ClaimPartyQuerySchema.parse({ ...(await searchParams), limit: 20 });
  const page = await claimsService.listForParty(user, query);
  const isClient = user.role === 'CLIENT';
  const base = `${qualityBase(user.role)}/claims`;

  return (
    <div className="space-y-8">
      <PageTitle
        kicker={isClient ? 'AFTER-MOVE SUPPORT' : 'DISPUTES'}
        title={isClient ? 'MY CLAIMS.' : 'CLAIMS ABOUT ME.'}
      >
        {isClient ? (
          <Link href={`${base}/new`} className={buttonVariants({ variant: 'hazard' })}>
            New claim
          </Link>
        ) : null}
      </PageTitle>

      <nav
        aria-label="Filter by status"
        className="mono flex flex-wrap gap-px border border-ink bg-ink text-[10px]"
      >
        {(['ALL', ...CLAIM_STATUSES] as const).map((status) => (
          <Link
            key={status}
            href={status === 'ALL' ? base : `${base}?status=${status}`}
            aria-current={query.status === status ? 'true' : undefined}
            className={cn(
              'flex-1 bg-paper px-4 py-2 text-center hover:bg-ink hover:text-paper',
              query.status === status && 'bg-ink text-paper',
            )}
          >
            {status === 'ALL' ? 'All' : CLAIM_STATUS_LABELS[status]}
          </Link>
        ))}
      </nav>

      {page.data.length === 0 ? (
        <EmptyBlock title="Nothing here.">
          {isClient
            ? 'If something went wrong with a move, open a claim and our team will follow up.'
            : 'No client has opened a claim about your moves. Keep it up.'}
        </EmptyBlock>
      ) : (
        <ul className="divide-y divide-ink border border-ink">
          {page.data.map((claim) => (
            <li key={claim.id}>
              <Link
                href={`${base}/${claim.id}`}
                className="grid gap-3 p-5 transition-colors hover:bg-paper-soft md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <p className="mono text-[10px] text-ink-80">
                    {claim.reference} · {CLAIM_CATEGORY_LABELS[claim.category]}
                    {claim.moveReference ? ` · MOVE ${claim.moveReference}` : ''}
                    {!isClient && claim.client ? ` · ${claim.client.name}` : ''}
                  </p>
                  <p className="mt-1 text-lg font-semibold">{claim.subject}</p>
                  <p className="mono mt-1 text-[10px] text-ink-40">
                    UPDATED {formatDate(claim.updatedAt)}
                  </p>
                </div>
                <ClaimStamp status={claim.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mono text-[10px] text-ink-40">{page.meta.itemCount} CLAIM(S)</p>
    </div>
  );
}
