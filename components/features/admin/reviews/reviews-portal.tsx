'use client';

import { useEffect, useState } from 'react';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  EyeOff,
  MessageSquareText,
  RotateCcw,
  Sparkles,
  Square,
} from 'lucide-react';
import { AdminBadge } from '@/components/ui/admin-badge';
import { AdminButton } from '@/components/ui/admin-button';
import { AdminCard } from '@/components/ui/admin-card';
import { AdminSelect } from '@/components/ui/admin-select';
import { useAdminQuality, useAdminReviews, useReviewModeration } from '@/hooks/content/admin';
import { useAuthHeaders } from '@/hooks/use-auth-headers';
import { ReviewInsightsSchema } from '@/lib/quality/ai-schemas';
import {
  REVIEW_STATUSES,
  REVIEW_STATUS_LABELS,
  REVIEW_TOPIC_LABELS,
  SENTIMENTS,
} from '@/lib/quality/constants';
import type { ReviewStatus, Sentiment } from '@/types';
import { useAdminShell } from '../shell/admin-shell-context';
import { RatingDots, SentimentBadge, SourceBadge, adminDate, apiErrorMessage } from '../quality-ui';

const STATUS_VARIANT: Record<ReviewStatus, 'success' | 'destructive' | 'outline'> = {
  PUBLISHED: 'success',
  FLAGGED: 'destructive',
  HIDDEN: 'outline',
};

/** A-09 review moderation: flagged-first queue, publish / hide, and streamed AI insights. */
export function ReviewsPortal() {
  const { setPage: publishPage, clearPage, clearFooter } = useAdminShell();
  const [status, setStatus] = useState<ReviewStatus | 'ALL'>('FLAGGED');
  const [sentiment, setSentiment] = useState<Sentiment | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const reviews = useAdminReviews({ page, limit: 15, status, sentiment });
  const quality = useAdminQuality();
  const moderation = useReviewModeration();

  useEffect(() => {
    publishPage({
      breadcrumbs: [{ label: 'Admin', href: '/admin' }, { label: 'Customer reviews' }],
      title: 'Customer reviews',
      description: 'Moderate client ratings of movers. Toxic content is held back automatically.',
    });
    clearFooter();
    return () => {
      clearPage();
      clearFooter();
    };
  }, [clearFooter, clearPage, publishPage]);

  useEffect(() => setPage(1), [status, sentiment]);

  const moderate = (id: string, next: ReviewStatus) =>
    moderation.mutate(
      { id, status: next },
      {
        onSuccess: () => toast.success(`Review ${REVIEW_STATUS_LABELS[next].toLowerCase()}`),
        onError: (error) => toast.error(apiErrorMessage(error, 'Moderation failed')),
      },
    );

  const stats = quality.data?.reviews;

  return (
    <div className="space-y-6 p-4 min-[426px]:p-10">
      <div className="grid gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-4">
        {[
          ['Average rating', stats ? (stats.averageRating ?? '—') : undefined],
          ['Published', stats?.byStatus.PUBLISHED],
          ['Waiting (flagged)', stats?.byStatus.FLAGGED],
          ['Negative sentiment', stats?.negative],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-card px-5 py-4">
            <p className="text-xl font-bold tracking-[-0.02em]">{value ?? '…'}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <InsightsCard />

      <AdminCard className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquareText className="size-4 text-primary" /> Moderation queue
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminSelect
              value={status}
              onValueChange={(value) => setStatus(value as ReviewStatus | 'ALL')}
              options={[
                { value: 'ALL', label: 'All statuses' },
                ...REVIEW_STATUSES.map((value) => ({ value, label: REVIEW_STATUS_LABELS[value] })),
              ]}
              ariaLabel="Filter by status"
            />
            <AdminSelect
              value={sentiment}
              onValueChange={(value) => setSentiment(value as Sentiment | 'ALL')}
              options={[
                { value: 'ALL', label: 'Any sentiment' },
                ...SENTIMENTS.map((value) => ({ value, label: value.toLowerCase() })),
              ]}
              ariaLabel="Filter by sentiment"
            />
          </div>
        </div>

        {reviews.isPending ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : null}

        {reviews.isError ? (
          <div className="px-6 py-12 text-center">
            <CircleAlert className="mx-auto size-5 text-destructive" />
            <p className="mt-3 font-semibold">Reviews could not be loaded.</p>
            <AdminButton className="mt-4" size="sm" onClick={() => reviews.refetch()}>
              <RotateCcw /> Retry
            </AdminButton>
          </div>
        ) : null}

        {reviews.data && reviews.data.data.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <MessageSquareText className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 font-semibold">Nothing to moderate here.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Change the filters to see published or hidden reviews.
            </p>
          </div>
        ) : null}

        {reviews.data && reviews.data.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {reviews.data.data.map((review) => (
              <li
                key={review.id}
                className="grid gap-3 px-6 py-4 lg:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <RatingDots value={review.rating} />
                    <span className="font-semibold text-foreground">{review.client?.name}</span>
                    <span>→ {review.mover?.name}</span>
                    <span>· {review.moveReference}</span>
                    <span>· {adminDate.format(new Date(review.createdAt))}</span>
                  </div>
                  <p className="text-sm leading-6">{review.comment}</p>
                  {review.moverReply ? (
                    <p className="border-l-2 border-primary pl-3 text-xs text-muted-foreground">
                      Reply: {review.moverReply.text}
                    </p>
                  ) : null}
                  {review.moderation ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <SentimentBadge sentiment={review.moderation.sentiment} />
                      <SourceBadge
                        source={review.moderation.source}
                        model={review.moderation.model}
                      />
                      {review.moderation.topics.map((topic) => (
                        <AdminBadge key={topic} variant="outline">
                          {REVIEW_TOPIC_LABELS[topic]}
                        </AdminBadge>
                      ))}
                      {review.moderation.reasons.map((reason) => (
                        <AdminBadge key={reason} variant="destructive">
                          {reason}
                        </AdminBadge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-start gap-2 lg:flex-col lg:items-end">
                  <AdminBadge variant={STATUS_VARIANT[review.status]}>
                    {REVIEW_STATUS_LABELS[review.status]}
                  </AdminBadge>
                  <div className="flex gap-2">
                    {review.status !== 'PUBLISHED' ? (
                      <AdminButton
                        size="sm"
                        variant="outline"
                        disabled={moderation.isPending}
                        onClick={() => moderate(review.id, 'PUBLISHED')}
                      >
                        <Eye /> Publish
                      </AdminButton>
                    ) : null}
                    {review.status !== 'HIDDEN' ? (
                      <AdminButton
                        size="sm"
                        variant="destructive"
                        disabled={moderation.isPending}
                        onClick={() => moderate(review.id, 'HIDDEN')}
                      >
                        <EyeOff /> Hide
                      </AdminButton>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {reviews.data && reviews.data.meta.pageCount > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Page {reviews.data.meta.page} of {reviews.data.meta.pageCount}
            </p>
            <div className="flex gap-2">
              <AdminButton
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeft /> Previous
              </AdminButton>
              <AdminButton
                variant="outline"
                size="sm"
                disabled={!reviews.data.meta.hasNextPage}
                onClick={() => setPage((value) => value + 1)}
              >
                Next <ChevronRight />
              </AdminButton>
            </div>
          </div>
        ) : null}
      </AdminCard>
    </div>
  );
}

/** AI SDK UI useObject (course ch.6): the JSON object fills in on screen while it streams. */
function InsightsCard() {
  const headers = useAuthHeaders();
  const insights = useObject({
    api: '/api/ai/reviews/insights',
    schema: ReviewInsightsSchema,
    headers,
    onError: () => toast.error('Insights could not be generated'),
  });
  const data = insights.object;

  return (
    <AdminCard className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> What clients are saying
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            AI summary of the latest 40 published reviews (no names are sent to the model).
          </p>
        </div>
        {insights.isLoading ? (
          <AdminButton size="sm" variant="outline" onClick={insights.stop}>
            <Square /> Stop
          </AdminButton>
        ) : (
          <AdminButton size="sm" onClick={() => insights.submit({})}>
            <Sparkles /> {data ? 'Refresh insights' : 'Generate insights'}
          </AdminButton>
        )}
      </div>

      {data ? (
        <div className="mt-5 space-y-4">
          {data.headline ? (
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {data.headline}
              {data.overallSentiment ? <SentimentBadge sentiment={data.overallSentiment} /> : null}
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-3">
            {(
              [
                ['Strengths', data.strengths],
                ['Recurring issues', data.issues],
                ['Recommended actions', data.recommendedActions],
              ] as const
            ).map(([title, items]) => (
              <div key={title} className="rounded-md border border-border p-4">
                <p className="text-xs font-semibold">{title}</p>
                <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
                  {((items ?? []) as (string | undefined)[]).filter(Boolean).map((item, index) => (
                    <li key={index} className="flex gap-2">
                      <span
                        aria-hidden
                        className="mt-[7px] size-1 shrink-0 rounded-full bg-primary"
                      />
                      {item}
                    </li>
                  ))}
                  {insights.isLoading && !((items ?? []) as unknown[]).length ? (
                    <li className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                  ) : null}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </AdminCard>
  );
}
