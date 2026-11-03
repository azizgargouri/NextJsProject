import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePageUser } from '@/server/shared/auth/session';
import { reviewsRepository, reviewsService } from '@/server/modules/reviews';
import { connectMongo } from '@/server/shared/database/mongoose';
import { UserModel } from '@/server/shared/database/models/user.model';
import {
  EmptyBlock,
  PageTitle,
  ReviewStamp,
  formatDate,
} from '@/components/features/workspace/workspace-blocks';
import { Stars } from '@/components/features/workspace/workspace-ui';
import { ReviewForm } from '@/components/features/workspace/review-form';
import { ReviewReplyForm } from '@/components/features/workspace/review-reply-form';
import { RatingSummary } from '@/components/features/workspace/rating-summary';
import type { RatingSummaryDto, ReviewDto } from '@/types';

export const metadata: Metadata = { title: 'Reviews' };

/** One route, two experiences: clients write reviews, movers read and answer theirs. */
export default async function ReviewsPage() {
  const user = await requirePageUser();
  const page = await reviewsService.listForParty(user, { page: 1, limit: 30 });

  if (user.role === 'MOVER') {
    const summary = (await reviewsRepository.summary(user.sub)) as unknown as RatingSummaryDto;
    return (
      <div className="space-y-8">
        <PageTitle kicker="REPUTATION" title="MY RATING.">
          <Link
            href={`/movers/${user.sub}`}
            className="mono text-[11px] underline underline-offset-4 hover:text-hazard"
          >
            See my public page
          </Link>
        </PageTitle>
        <RatingSummary summary={summary} />
        {page.data.length === 0 ? (
          <EmptyBlock title="No reviews yet.">
            Reviews appear here once clients rate a completed move.
          </EmptyBlock>
        ) : (
          <ul className="space-y-4">
            {page.data.map((review) => (
              <ReviewCard key={review.id} review={review}>
                <ReviewReplyForm reviewId={review.id} existing={review.moverReply?.text} />
              </ReviewCard>
            ))}
          </ul>
        )}
      </div>
    );
  }

  await connectMongo();
  const movers = await UserModel.find({ role: 'MOVER', status: 'ACTIVE', deletedAt: null })
    .select('name')
    .sort({ name: 1 })
    .lean<{ _id: unknown; name: string }[]>();

  return (
    <div className="space-y-10">
      <PageTitle kicker="AFTER YOUR MOVE" title="RATE YOUR MOVER." />
      <ReviewForm movers={movers.map((mover) => ({ id: String(mover._id), name: mover.name }))} />
      <section className="space-y-4">
        <h2 className="mono text-[11px]">My reviews ({page.meta.itemCount})</h2>
        {page.data.length === 0 ? (
          <EmptyBlock title="No review yet.">
            Your reviews help other clients pick the right mover.
          </EmptyBlock>
        ) : (
          <ul className="space-y-4">
            {page.data.map((review) => (
              <ReviewCard key={review.id} review={review} showStatus />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReviewCard({
  review,
  showStatus,
  children,
}: {
  review: ReviewDto;
  showStatus?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="border border-ink p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Stars value={review.rating} />
          <span className="mono text-[10px] text-ink-80">
            {showStatus ? review.mover?.name : review.client?.name} · MOVE {review.moveReference}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="mono text-[10px] text-ink-40">{formatDate(review.createdAt)}</span>
          {showStatus ? <ReviewStamp status={review.status} /> : null}
        </div>
      </div>
      <p className="mt-3 whitespace-pre-line leading-7">{review.comment}</p>
      {showStatus && review.moderationNote ? (
        <p className="mono mt-2 text-[10px] normal-case tracking-normal text-hazard">
          Moderator: {review.moderationNote}
        </p>
      ) : null}
      {review.moverReply && !children ? (
        <blockquote className="mt-4 border-l-4 border-hazard pl-4 text-sm">
          <p className="mono text-[10px] text-ink-80">REPLY FROM {review.mover?.name}</p>
          <p className="mt-1 leading-6">{review.moverReply.text}</p>
        </blockquote>
      ) : null}
      {children}
    </li>
  );
}
