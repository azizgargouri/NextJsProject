import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePageUser } from '@/server/shared/auth/session';
import { ClaimNotFoundError, claimsService } from '@/server/modules/claims';
import {
  CLAIM_CATEGORY_LABELS,
  CLAIM_OUTCOME_LABELS,
  DAMAGE_SEVERITY_LABELS,
} from '@/lib/quality/constants';
import {
  ClaimStamp,
  PageTitle,
  formatDate,
} from '@/components/features/workspace/workspace-blocks';
import { ClaimTimeline } from '@/components/features/workspace/claim-timeline';
import { ClaimMessageForm } from '@/components/features/workspace/claim-message-form';
import { EvidencePhotoGallery } from '@/components/features/workspace/evidence-photo-gallery';
import { PrintDossierButton } from '@/components/features/workspace/print-dossier-button';

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/claims"
          className="mono inline-flex items-center gap-2 text-[11px] hover:text-hazard"
        >
          <ArrowLeft className="size-4" /> All claims
        </Link>
        <PrintDossierButton reference={claim.reference} />
      </div>
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

          {claim.evidencePhotos && claim.evidencePhotos.length > 0 ? (
            <div className="space-y-4 border border-ink p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="mono text-[10px] text-ink-80">
                  ATTACHED PHOTO EVIDENCE ({claim.evidencePhotos.length}) · CLICK ANY PHOTO TO
                  INSPECT
                </p>
              </div>
              <EvidencePhotoGallery
                photos={claim.evidencePhotos}
                detectedItems={claim.visionAnalysis?.detectedItems}
                variant="workspace"
              />
            </div>
          ) : null}

          {claim.visionAnalysis ? (
            <div className="space-y-4 border-2 border-ink bg-ink/[0.03] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="mono text-[10px] font-bold text-hazard">
                  MULTIMODAL VISION AI · DAMAGE ASSESSMENT
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono border border-hazard bg-hazard/10 px-2 py-0.5 text-[10px] font-bold text-hazard">
                    DAMAGE RATE: {claim.visionAnalysis.overallDamageRatePct ?? 65}%
                  </span>
                  <span className="mono border border-ink px-2 py-0.5 text-[10px]">
                    {DAMAGE_SEVERITY_LABELS[claim.visionAnalysis.overallSeverity].toUpperCase()} ·{' '}
                    {Math.round(claim.visionAnalysis.confidence * 100)}% CONFIDENCE
                  </span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="border border-ink bg-paper p-3">
                  <p className="mono text-[10px] text-ink-80">OVERALL DAMAGE RATE</p>
                  <p className="display mt-1 text-xl text-hazard">
                    {claim.visionAnalysis.overallDamageRatePct ?? 65}%
                  </p>
                  <div className="mt-1.5 h-1.5 w-full border border-ink bg-ink/10">
                    <div
                      className="h-full bg-hazard"
                      style={{ width: `${claim.visionAnalysis.overallDamageRatePct ?? 65}%` }}
                    />
                  </div>
                </div>
                <div className="border border-ink bg-paper p-3">
                  <p className="mono text-[10px] text-ink-80">ESTIMATED REPAIR / REPLACEMENT</p>
                  <p className="display mt-1 text-xl">
                    {claim.visionAnalysis.estimatedRepairMinTnd} –{' '}
                    {claim.visionAnalysis.estimatedRepairMaxTnd} TND
                  </p>
                </div>
                <div className="border border-hazard bg-paper p-3">
                  <p className="mono text-[10px] text-hazard">AI RECOMMENDED INDEMNITY</p>
                  <p className="display mt-1 text-xl text-hazard">
                    {claim.visionAnalysis.recommendedClaimAmountTnd} TND
                  </p>
                </div>
              </div>
              <ul className="space-y-2">
                {claim.visionAnalysis.detectedItems.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex flex-wrap items-center justify-between gap-2 border border-ink/40 bg-paper px-3 py-2 text-xs"
                  >
                    <div className="min-w-[200px] flex-1">
                      <p className="font-bold">
                        #{idx + 1} · {item.name}{' '}
                        <span className="font-normal text-ink-80">({item.material})</span>
                      </p>
                      <p className="text-ink-80">{item.damageType}</p>
                    </div>
                    <div className="mono text-right text-[10px]">
                      <p className="font-bold text-hazard">
                        Damage {item.damageRatePct ?? (item.repairable ? 45 : 95)}% ·{' '}
                        {item.estimatedCostTnd} TND
                      </p>
                      <p className="text-ink-80">
                        {item.repairable ? 'Repairable' : 'Replacement required'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

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
