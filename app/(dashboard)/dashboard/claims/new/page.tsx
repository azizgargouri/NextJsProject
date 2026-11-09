import type { Metadata } from 'next';
import { requirePageUser } from '@/server/shared/auth/session';
import { connectMongo } from '@/server/shared/database/mongoose';
import { UserModel } from '@/server/shared/database/models/user.model';
import { ClaimForm } from '@/components/features/workspace/claim-form';
import { PageTitle } from '@/components/features/workspace/workspace-blocks';

export const metadata: Metadata = { title: 'New claim' };

/** Server Component loads the mover list and passes it as props to the Client form. */
export default async function NewClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ moveRef?: string; moverId?: string }>;
}) {
  const { moveRef, moverId } = await searchParams;
  await requirePageUser(['CLIENT']);
  await connectMongo();
  const movers = await UserModel.find({ role: 'MOVER', status: 'ACTIVE', deletedAt: null })
    .select('name')
    .sort({ name: 1 })
    .lean<{ _id: unknown; name: string }[]>();

  return (
    <div className="space-y-8">
      <PageTitle kicker="AFTER-MOVE SUPPORT" title="OPEN A CLAIM." />
      <p className="mono max-w-2xl text-[11px] normal-case tracking-normal text-ink-80">
        Tell us what went wrong. Your claim is triaged automatically so urgent cases reach a MoveUp
        agent first. You can follow every step and talk with the team on the claim page.
      </p>
      <ClaimForm
        movers={movers.map((mover) => ({ id: String(mover._id), name: mover.name }))}
        defaultMoveReference={moveRef}
        defaultMoverId={moverId}
      />
    </div>
  );
}
