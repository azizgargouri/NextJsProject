import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePageUser } from '@/server/shared/auth/session';
import { ClaimNotFoundError, claimsService } from '@/server/modules/claims';
import { CLAIM_CATEGORY_LABELS, CLAIM_OUTCOME_LABELS } from '@/lib/quality/constants';
import {
  ClaimStamp,
  PageTitle,
  formatDate,
} from '@/components/features/workspace/workspace-blocks';
import { ClaimTimeline } from '@/components/features/workspace/claim-timeline';
import { ClaimMessageForm } from '@/components/features/workspace/claim-message-form';

export const metadata: Metadata = { title: 'Claim' };

/**
 * Dynamic route /dashboard/claims/[id] (course ch.2 "routes dynamiques").
 * Rendered on the server; unknown ids — or claims the user may not see — give a 404 via notFound().
 */
export default async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;

  let claim;
  try {
    claim = await claimsService.getForActor(user, id);
  } catch (error) {
    if (error instanceof ClaimNotFoundError) notFound();
    throw error;
  }

  const closed = claim.status === 'RESOLVED' || claim.status === 'REJECTED';

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/claims"
        className="mono inline-flex items-center gap-2 text-[11px] hover:text-hazard"
      >
        <ArrowLeft className="size-4" /> All claims
      </Link>
      <PageTitle
        kicker={`${claim.reference} · ${CLAIM_CATEGORY_LABELS[claim.category]}`}
        title={claim.subject.toUpperCase()}
      >
        <ClaimStamp status={claim.status} />
      </PageTitle>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-6">
          <div className="border border-ink p-5">
            <p className="mono text-[10px] text-ink-80">STATEMENT</p>
            <p className="mt-3 whitespace-pre-line leading-7">{claim.description}</p>
          </div>

          {claim.resolution ? (
            <div className="border-2 border-hazard p-5">
              <p className="mono text-[10px] text-hazard">
                DECISION · {formatDate(claim.resolution.resolvedAt)}
              </p>
              <p className="display mt-2 text-2xl">
                {CLAIM_OUTCOME_LABELS[claim.resolution.outcome]}
                {claim.resolution.amount ? ` — ${claim.resolution.amount} TND` : ''}
              </p>
              <p className="mt-2 whitespace-pre-line leading-7">{claim.resolution.note}</p>
            </div>
          ) : null}

          <div>
            <h2 className="mono mb-3 text-[11px]">Conversation</h2>
            <ClaimTimeline events={claim.timeline} viewerId={user.sub} />
          </div>

          {closed ? (
            <p className="mono text-[11px] normal-case tracking-normal text-ink-80">
              This claim is closed. Ask the assistant or contact support if you need to reopen it.
            </p>
          ) : (
            <ClaimMessageForm claimId={claim.id} />
          )}
        </section>

        <aside className="mono h-fit divide-y divide-ink border border-ink text-[11px]">
          {[
            ['Opened', formatDate(claim.createdAt)],
            ['Move', claim.moveReference ?? '—'],
            ['Mover', claim.mover?.name ?? '—'],
            ['Client', claim.client?.name ?? '—'],
            ['Amount claimed', claim.amountClaimed ? `${claim.amountClaimed} TND` : '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 p-4">
              <span className="text-ink-80">{label}</span>
              <span className="text-right normal-case tracking-normal">{value}</span>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
