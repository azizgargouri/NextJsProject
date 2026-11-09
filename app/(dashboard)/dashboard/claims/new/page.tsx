import type { Metadata } from 'next';
import { requirePageUser } from '@/server/shared/auth/session';
import { connectMongo } from '@/server/shared/database/mongoose';
import { UserModel } from '@/server/shared/database/models/user.model';
import { MoverProfileModel } from '@/server/shared/database/models/mover-profile.model';
import { ClaimForm, type CompletedMoveOption } from '@/components/features/workspace/claim-form';
import { PageTitle } from '@/components/features/workspace/workspace-blocks';

export const metadata: Metadata = { title: 'New claim' };

/**
 * Server Component loads the client's completed move history (linked to real movers)
 * so the client chooses from a classy move selector instead of typing a raw reference.
 */
export default async function NewClaimPage() {
  await requirePageUser(['CLIENT']);
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

  const primaryMover = moverList[0] ?? { id: '', name: 'MoveUp Certified Partner' };
  const secondaryMover = moverList[1] ?? primaryMover;

  const completedMoves: CompletedMoveOption[] = [
    {
      moveReference: 'MV-2026-0155',
      route: 'Tunis (La Marsa) → Sousse (Kantaoui)',
      completedDate: '07 Nov 2026',
      truckTier: '20m³ Padded Van · 3 Crew + Lift',
      moverId: primaryMover.id,
      moverName: primaryMover.name,
      totalPaidTnd: 680,
    },
    {
      moveReference: 'MV-2026-0142',
      route: 'Ariana (Ennasr 2) → Les Berges du Lac 2',
      completedDate: '04 Nov 2026',
      truckTier: '30m³ Heavy Box Truck · 4 Crew',
      moverId: primaryMover.id,
      moverName: primaryMover.name,
      totalPaidTnd: 850,
    },
    {
      moveReference: 'MV-2026-0118',
      route: 'Tunis (El Menzah 6) → Hammamet Nord',
      completedDate: '28 Oct 2026',
      truckTier: '14m³ Urban Transit Van · 2 Crew',
      moverId: primaryMover.id,
      moverName: primaryMover.name,
      totalPaidTnd: 490,
    },
    {
      moveReference: 'MV-2026-0097',
      route: 'Sousse (Sahloul) → Monastir Marina',
      completedDate: '19 Oct 2026',
      truckTier: '20m³ Padded Van · Fragile Pack',
      moverId: secondaryMover.id,
      moverName: secondaryMover.name,
      totalPaidTnd: 540,
    },
  ];

  return (
    <div className="space-y-8">
      <PageTitle kicker="AFTER-MOVE SUPPORT" title="OPEN A CLAIM." />
      <p className="mono max-w-2xl text-[11px] normal-case tracking-normal text-ink-80">
        Select the completed move your claim concerns, upload photos of all damaged items, and draw
        red rectangles over the damaged zones so our Vision AI can estimate the exact damage rate
        and TND compensation.
      </p>
      <ClaimForm movers={moverList} completedMoves={completedMoves} />
    </div>
  );
}
