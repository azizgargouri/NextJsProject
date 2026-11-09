'use client';

import { useEffect, useState } from 'react';
import { experimental_useObject as useObject, useCompletion } from '@ai-sdk/react';
import { toast } from 'sonner';
import { Bot, Camera, CheckCircle2, CircleAlert, Scale, Sparkles, Square } from 'lucide-react';
import { AdminBadge } from '@/components/ui/admin-badge';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminInput } from '@/components/ui/admin-input';
import { AdminSelect } from '@/components/ui/admin-select';
import { AdminSheet } from '@/components/ui/admin-sheet';
import { useAdminClaim, useClaimUpdate } from '@/hooks/content/admin';
import { useAuthHeaders } from '@/hooks/use-auth-headers';
import { ClaimMediationSchema } from '@/lib/quality/ai-schemas';
import {
  CLAIM_CATEGORY_LABELS,
  CLAIM_OUTCOMES,
  CLAIM_OUTCOME_LABELS,
  CLAIM_PRIORITIES,
  CLAIM_PRIORITY_LABELS,
  CLAIM_STATUS_LABELS,
  CLAIM_TRANSITIONS,
  DAMAGE_SEVERITY_LABELS,
} from '@/lib/quality/constants';
import type { AdminClaimUpdatePayload, ClaimDto, ClaimOutcome, ClaimPriority } from '@/types';
import {
  AdminField,
  AdminTextarea,
  SentimentBadge,
  SourceBadge,
  adminDate,
  apiErrorMessage,
} from '../quality-ui';
import { PRIORITY_VARIANT, STATUS_VARIANT } from './disputes-portal';
import { EvidencePhotoGallery } from '@/components/features/workspace/evidence-photo-gallery';

export function ClaimSheet({
  claimId,
  onOpenChange,
}: {
  claimId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const claim = useAdminClaim(claimId);
  return (
    <AdminSheet
      open={Boolean(claimId)}
      onOpenChange={onOpenChange}
      title={claim.data ? claim.data.reference : 'Claim'}
      description={claim.data ? claim.data.subject : 'Loading claim…'}
      className="min-[1500px]:w-[560px]"
    >
      {claim.isPending ? <div className="h-40 animate-pulse rounded-md bg-muted" /> : null}
      {claim.isError ? (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <CircleAlert className="size-4" /> Claim could not be loaded.
        </p>
      ) : null}
      {claim.data ? (
        <ClaimDetail key={claim.data.id + claim.data.updatedAt} claim={claim.data} />
      ) : null}
    </AdminSheet>
  );
}

function ClaimDetail({ claim }: { claim: ClaimDto }) {
  const update = useClaimUpdate();
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState<ClaimOutcome>('PARTIAL_REFUND');
  const [amount, setAmount] = useState('');
  const [decision, setDecision] = useState('');
  const [instruction, setInstruction] = useState('');
  const headers = useAuthHeaders();

  // AI SDK UI useCompletion (course ch.6 "Aide à la rédaction"): single streamed answer, no history.
  const draft = useCompletion({
    api: `/api/ai/claims/${claim.id}/draft`,
    streamProtocol: 'text',
    headers,
    onError: () => toast.error('Draft could not be generated'),
  });

  // AI SDK UI useObject (course ch.6 "streamObject + useObject"): streams structured arbitration & compensation.
  const mediationStream = useObject({
    api: `/api/ai/claims/${claim.id}/mediate`,
    schema: ClaimMediationSchema,
    headers,
    onError: () => toast.error('AI mediation could not be generated'),
  });

  const activeMediation = mediationStream.object ?? claim.aiMediation ?? null;

  // Tokens stream into the decision textarea as they arrive.
  useEffect(() => {
    if (draft.completion) setDecision(draft.completion);
  }, [draft.completion]);

  const applyMediationProposal = () => {
    if (!activeMediation) return;
    if (activeMediation.recommendedOutcome) {
      setOutcome(activeMediation.recommendedOutcome);
    }
    if (activeMediation.recommendedAmountTnd !== undefined) {
      setAmount(
        activeMediation.recommendedOutcome === 'NO_ACTION'
          ? ''
          : String(activeMediation.recommendedAmountTnd),
      );
    }
    if (activeMediation.draftResolutionNote) {
      setDecision(activeMediation.draftResolutionNote);
    }
    toast.success('AI mediation proposal applied to the resolution form');
  };

  const run = (payload: AdminClaimUpdatePayload, success: string) =>
    update.mutate(
      { id: claim.id, payload },
      {
        onSuccess: () => {
          toast.success(success);
          setNote('');
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Update failed')),
      },
    );

  const nextStatuses = CLAIM_TRANSITIONS[claim.status].filter((status) => status !== 'RESOLVED');
  const canResolve = claim.status === 'UNDER_REVIEW';

  return (
    <div className="space-y-6 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <AdminBadge variant={STATUS_VARIANT[claim.status]}>
          {CLAIM_STATUS_LABELS[claim.status]}
        </AdminBadge>
        {claim.priority ? (
          <AdminBadge variant={PRIORITY_VARIANT[claim.priority]}>
            {CLAIM_PRIORITY_LABELS[claim.priority]}
          </AdminBadge>
        ) : null}
        <AdminBadge variant="outline">{CLAIM_CATEGORY_LABELS[claim.category]}</AdminBadge>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-md border border-border p-4 text-xs">
        {[
          ['Client', claim.client ? `${claim.client.name} · ${claim.client.email ?? ''}` : '—'],
          ['Mover', claim.mover?.name ?? '—'],
          ['Move', claim.moveReference ?? '—'],
          ['Amount claimed', claim.amountClaimed ? `${claim.amountClaimed} TND` : '—'],
          ['Opened', adminDate.format(new Date(claim.createdAt))],
          ['Updated', adminDate.format(new Date(claim.updatedAt))],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 break-words font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h3 className="text-xs font-semibold">Client statement</h3>
        <p className="mt-2 whitespace-pre-line leading-6 text-muted-foreground">
          {claim.description}
        </p>
      </section>

      {claim.evidencePhotos && claim.evidencePhotos.length > 0 ? (
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold">
            <Camera className="size-3.5 text-primary" /> Photographic evidence (
            {claim.evidencePhotos.length}) · Click to inspect
          </h3>
          <EvidencePhotoGallery
            photos={claim.evidencePhotos}
            detectedItems={claim.visionAnalysis?.detectedItems}
            variant="admin"
          />
        </section>
      ) : null}

      {claim.visionAnalysis ? (
        <section className="space-y-2.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-xs font-semibold">
              <Camera className="size-4 text-amber-500" /> Multimodal Vision AI Damage Scan
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <AdminBadge variant="destructive">
                {DAMAGE_SEVERITY_LABELS[claim.visionAnalysis.overallSeverity]}
              </AdminBadge>
              <AdminBadge variant="outline">
                Damage rate {claim.visionAnalysis.overallDamageRatePct ?? 65}%
              </AdminBadge>
              <SourceBadge
                source={claim.visionAnalysis.source}
                model={claim.visionAnalysis.model}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-card p-2.5 text-xs">
            <div>
              <p className="text-muted-foreground">AI damage rate</p>
              <p className="font-semibold text-destructive">
                {claim.visionAnalysis.overallDamageRatePct ?? 65}%
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Estimated repair range</p>
              <p className="font-semibold">
                {claim.visionAnalysis.estimatedRepairMinTnd} –{' '}
                {claim.visionAnalysis.estimatedRepairMaxTnd} TND
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Recommended indemnity</p>
              <p className="font-semibold text-primary">
                {claim.visionAnalysis.recommendedClaimAmountTnd} TND
              </p>
            </div>
          </div>
          <ul className="space-y-1.5 text-xs">
            {claim.visionAnalysis.detectedItems.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-2 rounded border border-border bg-card/60 px-2.5 py-1.5"
              >
                <div>
                  <span className="font-medium">
                    #{idx + 1} · {item.name}
                  </span>{' '}
                  <span className="text-muted-foreground">({item.material})</span>
                  <p className="text-muted-foreground">{item.damageType}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{item.estimatedCostTnd} TND</p>
                  <p className="text-[11px] text-destructive">
                    {item.damageRatePct ?? (item.repairable ? 45 : 95)}% damage
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {claim.visionAnalysis.authenticityNotes ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Authenticity check: </span>
              {claim.visionAnalysis.authenticityNotes}
            </p>
          ) : null}
        </section>
      ) : null}

      {claim.aiTriage ? (
        <section className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-xs font-semibold">
              <Bot className="size-4 text-primary" /> Automatic triage
            </h3>
            <div className="flex gap-1.5">
              <SentimentBadge sentiment={claim.aiTriage.sentiment} />
              <SourceBadge source={claim.aiTriage.source} model={claim.aiTriage.model} />
            </div>
          </div>
          <p className="leading-6">{claim.aiTriage.summary}</p>
          <p className="text-xs leading-5 text-muted-foreground">
            <span className="font-semibold text-foreground">Suggested next step: </span>
            {claim.aiTriage.suggestedAction}
          </p>
          <p className="text-xs text-muted-foreground">
            Suggested {CLAIM_PRIORITY_LABELS[claim.aiTriage.priority].toLowerCase()} priority ·{' '}
            {CLAIM_CATEGORY_LABELS[claim.aiTriage.category].toLowerCase()} · confidence{' '}
            {Math.round(claim.aiTriage.confidence * 100)}%
          </p>
        </section>
      ) : null}

      <section>
        <h3 className="text-xs font-semibold">Timeline</h3>
        <ol className="mt-2 space-y-2">
          {claim.timeline.map((event, index) => (
            <li key={index} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {event.author?.name ?? event.authorRole}
                </span>
                <AdminBadge variant="outline">{event.authorRole.toLowerCase()}</AdminBadge>
                {event.status ? <span>→ {CLAIM_STATUS_LABELS[event.status]}</span> : null}
                <span className="ml-auto">{adminDate.format(new Date(event.createdAt))}</span>
              </div>
              {event.text ? (
                <p className="mt-1.5 whitespace-pre-line leading-6">{event.text}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {claim.resolution ? (
        <section className="rounded-md border border-border bg-muted/50 p-4">
          <h3 className="text-xs font-semibold">
            Decision · {CLAIM_OUTCOME_LABELS[claim.resolution.outcome]}
            {claim.resolution.amount ? ` · ${claim.resolution.amount} TND` : ''}
          </h3>
          <p className="mt-1.5 whitespace-pre-line leading-6 text-muted-foreground">
            {claim.resolution.note}
          </p>
        </section>
      ) : null}

      {/* AI Dispute Mediator & Compensation Calculator (streamObject + useObject) */}
      <section className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-xs font-semibold">
              <Scale className="size-4 text-primary" /> AI Dispute Mediator & Compensation
              Calculator
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Streams a structured settlement proposal cross-referencing vision evidence, mover
              history & MoveUp policy rules.
            </p>
          </div>
          {mediationStream.isLoading ? (
            <AdminButton size="sm" variant="outline" onClick={mediationStream.stop}>
              <Square /> Stop
            </AdminButton>
          ) : (
            <AdminButton size="sm" variant="default" onClick={() => mediationStream.submit({})}>
              <Sparkles /> {activeMediation ? 'Recalculate mediation' : 'Run AI Mediator'}
            </AdminButton>
          )}
        </div>

        {activeMediation ? (
          <div className="space-y-3 border-t border-border/60 pt-3">
            <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-card p-3 text-xs">
              <div>
                <p className="text-muted-foreground">Recommended outcome</p>
                <p className="mt-0.5 font-semibold">
                  {activeMediation.recommendedOutcome
                    ? CLAIM_OUTCOME_LABELS[activeMediation.recommendedOutcome]
                    : 'Calculating…'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Settlement amount</p>
                <p className="mt-0.5 text-base font-bold text-primary">
                  {activeMediation.recommendedAmountTnd !== undefined
                    ? `${activeMediation.recommendedAmountTnd} TND`
                    : '…'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Liability split</p>
                <p className="mt-0.5 font-semibold">
                  {activeMediation.moverLiabilityPct ?? 0}% Mover /{' '}
                  {activeMediation.clientLiabilityPct ?? 0}% Client
                </p>
              </div>
            </div>

            {/* Visual Liability Split Bar */}
            {activeMediation.moverLiabilityPct !== undefined ? (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Mover responsibility ({activeMediation.moverLiabilityPct}%)</span>
                  <span>
                    Confidence{' '}
                    {activeMediation.confidenceScore
                      ? `${Math.round(activeMediation.confidenceScore * 100)}%`
                      : '—'}
                  </span>
                </div>
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="bg-primary transition-all duration-300"
                    style={{ width: `${activeMediation.moverLiabilityPct}%` }}
                  />
                </div>
              </div>
            ) : null}

            {activeMediation.executiveSummary ? (
              <p className="text-xs leading-5">{activeMediation.executiveSummary}</p>
            ) : null}

            {activeMediation.compensationBreakdown &&
            activeMediation.compensationBreakdown.length > 0 ? (
              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-xs font-semibold">Compensation breakdown (TND)</p>
                <ul className="mt-2 divide-y divide-border text-xs">
                  {activeMediation.compensationBreakdown
                    .filter((row): row is NonNullable<typeof row> => Boolean(row && row.item))
                    .map((row, idx) => (
                      <li key={idx} className="flex items-start justify-between gap-2 py-1.5">
                        <div>
                          <p className="font-medium">{row.item}</p>
                          {row.rationale ? (
                            <p className="text-muted-foreground">{row.rationale}</p>
                          ) : null}
                        </div>
                        <span className="shrink-0 font-mono font-semibold">
                          {row.amountTnd !== undefined
                            ? `${row.amountTnd >= 0 ? '' : '−'}${Math.abs(row.amountTnd)} TND`
                            : '…'}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}

            {activeMediation.policyCitations && activeMediation.policyCitations.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold">Applicable policy & legal rules</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {activeMediation.policyCitations.filter(Boolean).map((citation, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                      <span>{citation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {canResolve && !mediationStream.isLoading ? (
              <AdminButton
                size="sm"
                variant="secondary"
                onClick={applyMediationProposal}
                className="w-full"
              >
                <CheckCircle2 /> Apply AI settlement proposal to decision form
              </AdminButton>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-3 border-t border-border pt-5">
        <h3 className="text-xs font-semibold">Handle the claim</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminField label="Priority" htmlFor="claim-priority">
            <AdminSelect
              id="claim-priority"
              value={claim.priority ?? 'MEDIUM'}
              onValueChange={(value) =>
                run({ priority: value as ClaimPriority }, 'Priority updated')
              }
              options={CLAIM_PRIORITIES.map((value) => ({
                value,
                label: CLAIM_PRIORITY_LABELS[value],
              }))}
              ariaLabel="Claim priority"
              disabled={update.isPending}
              className="w-full"
            />
          </AdminField>
        </div>
        <AdminField
          label="Message to client & mover"
          htmlFor="claim-note"
          hint="Appears in the claim conversation. Also used as the reason for a status change."
        >
          <AdminTextarea
            id="claim-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            rows={3}
          />
        </AdminField>
        <div className="flex flex-wrap gap-2">
          <AdminButton
            size="sm"
            variant="secondary"
            disabled={!note.trim() || update.isPending}
            onClick={() => run({ note: note.trim() }, 'Message posted')}
          >
            Post message
          </AdminButton>
          {nextStatuses.map((status) => (
            <AdminButton
              key={status}
              size="sm"
              variant={status === 'REJECTED' ? 'destructive' : 'outline'}
              disabled={update.isPending}
              onClick={() =>
                run(
                  { status, note: note.trim() || undefined },
                  `Moved to ${CLAIM_STATUS_LABELS[status]}`,
                )
              }
            >
              {status === 'UNDER_REVIEW' && claim.status !== 'OPEN'
                ? 'Reopen'
                : CLAIM_STATUS_LABELS[status]}
            </AdminButton>
          ))}
        </div>
      </section>

      {canResolve ? (
        <section className="space-y-3 border-t border-border pt-5">
          <h3 className="text-xs font-semibold">Record the decision</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminField label="Outcome" htmlFor="claim-outcome">
              <AdminSelect
                id="claim-outcome"
                value={outcome}
                onValueChange={(value) => setOutcome(value as ClaimOutcome)}
                options={CLAIM_OUTCOMES.map((value) => ({
                  value,
                  label: CLAIM_OUTCOME_LABELS[value],
                }))}
                ariaLabel="Decision outcome"
                className="w-full"
              />
            </AdminField>
            <AdminField label="Amount (TND)" htmlFor="claim-amount">
              <AdminInput
                id="claim-amount"
                type="number"
                min={0}
                step="0.001"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={outcome === 'NO_ACTION'}
              />
            </AdminField>
          </div>

          <div className="space-y-2 rounded-md border border-dashed border-border p-3">
            <AdminField
              label="Instruction for the AI draft (optional)"
              htmlFor="claim-ai-instruction"
            >
              <AdminInput
                id="claim-ai-instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="e.g. offer 150 TND for the table, apologise for the delay"
              />
            </AdminField>
            {draft.isLoading ? (
              <AdminButton size="sm" variant="outline" onClick={draft.stop}>
                <Square /> Stop
              </AdminButton>
            ) : (
              <AdminButton
                size="sm"
                variant="outline"
                onClick={() => void draft.complete(instruction || 'Draft the resolution message.')}
              >
                <Sparkles /> Draft with AI
              </AdminButton>
            )}
          </div>

          <AdminField label="Decision sent to both parties" htmlFor="claim-decision">
            <AdminTextarea
              id="claim-decision"
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
              rows={7}
              maxLength={1500}
            />
          </AdminField>
          <AdminButton
            disabled={decision.trim().length < 10 || update.isPending || draft.isLoading}
            onClick={() =>
              run(
                {
                  status: 'RESOLVED',
                  resolution: {
                    outcome,
                    amount: outcome === 'NO_ACTION' || !amount ? null : Number(amount),
                    note: decision.trim(),
                  },
                },
                'Claim resolved',
              )
            }
          >
            Resolve claim
          </AdminButton>
        </section>
      ) : claim.status === 'OPEN' ? (
        <p className="text-xs text-muted-foreground">
          Move the claim to “Under review” to record a decision.
        </p>
      ) : null}
    </div>
  );
}
