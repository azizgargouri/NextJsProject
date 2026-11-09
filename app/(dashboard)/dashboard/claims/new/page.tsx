import type { Metadata } from 'next';
import { requirePageUser } from '@/server/shared/auth/session';
import { connectMongo } from '@/server/shared/database/mongoose';
import { clientMoveOptions } from '@/server/modules/moves/moves.options';
import { UserModel } from '@/server/shared/database/models/user.model';
import { MoverProfileModel } from '@/server/shared/database/models/mover-profile.model';
import { ClaimForm } from '@/components/features/workspace/claim-form';
import { PageTitle } from '@/components/features/workspace/workspace-blocks';

export const metadata: Metadata = { title: 'New claim' };

/**
 * Server Component loads the client's completed move history (linked to real movers)
 * so the client chooses from a classy move selector instead of typing a raw reference.
 */
export default async function NewClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ moveRef?: string; moverId?: string }>;
}) {
  const user = await requirePageUser(['CLIENT']);
  // "File a claim" on the tracking page links here with the move already chosen.
  const { moveRef, moverId } = await searchParams;
  await connectMongo();

  const [movers, profiles] = await Promise.all([
    UserModel.find({ role: 'MOVER', status: 'ACTIVE', deletedAt: null })
      .select('name')
      .sort({ name: 1 })
      .lean<{ _id: unknown; name: string }[]>(),
    MoverProfileModel.find()
      .select('userId companyName')
      .lean<{ userId: string; companyName?: string }[]>(),
  ]);

  const companyByUserId = new Map(
    profiles.map((p) => [String(p.userId), p.companyName || undefined]),
  );
  const moverList = movers.map((mover) => {
    const id = String(mover._id);
    return {
      id,
      name: companyByUserId.get(id) ?? mover.name,
    };
  });

  // The client's real moves (booked or seeded), never invented ones.
  const completedMoves = await clientMoveOptions(user.sub);

  return (
    <div className="space-y-8">
      <PageTitle kicker="AFTER-MOVE SUPPORT" title="OPEN A CLAIM." />
      <p className="mono max-w-2xl text-[11px] normal-case tracking-normal text-ink-80">
        Select the completed move your claim concerns, upload photos of all damaged items, and draw
        red rectangles over the damaged zones so our Vision AI can estimate the exact damage rate
        and TND compensation.
      </p>
      <ClaimForm
        movers={moverList}
        completedMoves={completedMoves}
        defaultMoveReference={moveRef}
        defaultMoverId={moverId}
      />
    </div>
  );
}
