import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { reviewsService, ReviewNotFoundError } from '@/server/modules/reviews';
import { RatingSummary } from '@/components/features/workspace/rating-summary';
import { MoverScorecardCard } from '@/components/features/workspace/mover-scorecard';
import { Stars } from '@/components/features/workspace/workspace-ui';
import { formatDate } from '@/components/features/workspace/workspace-blocks';
import type { RatingSummaryDto } from '@/types';

/** Re-generate this public page at most every 5 minutes (ISR) — SEO-friendly and cheap. */
export const revalidate = 300;

async function load(id: string) {
  try {
    return await reviewsService.moverProfile(id);
  } catch (error) {
    if (error instanceof ReviewNotFoundError) return null;
    throw error;
  }
}

/** Dynamic metadata: the page title carries the mover's name and rating (SEO, course ch.2). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const profile = await load((await params).id);
  if (!profile) return { title: 'Mover not found' };
  const rating = profile.summary.average ? ` — ${profile.summary.average}/5` : '';
  return {
    title: `${profile.mover.name}${rating}`,
    description: `Verified client reviews of ${profile.mover.name} on MoveUp.`,
  };
}

/** PUBLIC dynamic route /movers/[id]: rating summary + latest published reviews. */
export default async function MoverPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await load((await params).id);
  if (!profile) notFound();

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-14 md:px-6">
      <Link href="/" className="mono text-[11px] font-bold">
        MOVE<span className="text-hazard">UP</span>
      </Link>
      <header className="border-b border-ink pb-6">
        <p className="mono text-[10px] text-hazard">VERIFIED MOVER</p>
        <h1 className="display mt-2 text-4xl md:text-6xl">{profile.mover.name.toUpperCase()}.</h1>
      </header>
      <RatingSummary summary={profile.summary as unknown as RatingSummaryDto} />
      <MoverScorecardCard moverId={profile.mover.id} moverName={profile.mover.name} />
      <ul className="space-y-4">
        {profile.latest.map((review) => (
          <li key={review.id} className="border border-ink p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Stars value={review.rating} />
              <span className="mono text-[10px] text-ink-40">
                {review.client?.name} · {formatDate(review.createdAt)}
              </span>
            </div>
            <p className="mt-3 leading-7">{review.comment}</p>
            {review.moverReply ? (
              <blockquote className="mt-4 border-l-4 border-hazard pl-4 text-sm">
                <p className="mono text-[10px] text-ink-80">REPLY</p>
                <p className="mt-1 leading-6">{review.moverReply.text}</p>
              </blockquote>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
