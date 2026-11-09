import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectMongo } from './shared/database/mongoose';
import { UserModel } from './shared/database/models/user.model';
import { MoverProfileModel } from './shared/database/models/mover-profile.model';
import { ClaimModel } from './shared/database/models/claim.model';
import { ReviewModel } from './shared/database/models/review.model';
import {
  mediateClaimByRules,
  moderateReviewByRules,
  triageClaimByRules,
  VISION_DEMO_PRESETS,
} from './modules/ai/ai.fallback';

try {
  process.loadEnvFile();
} catch {
  // No .env: use the caller's environment.
}

/**
 * Demo data for the quality domain (claims + reviews). Idempotent: run `yarn db:seed` first
 * (accounts), then `yarn db:seed:quality`. Uses the rule engine so it needs no AI key.
 */
async function seedQuality() {
  await connectMongo();
  const client = await UserModel.findOne({ email: 'client@moveup.tn' }).lean();
  const mover = await UserModel.findOne({ email: 'mover@moveup.tn' }).lean();
  const admin = await UserModel.findOne({ role: 'ADMIN' }).lean();
  if (!client || !mover || !admin)
    throw new Error('Run `yarn db:seed` first (demo accounts missing).');

  // A second mover so ratings can be compared.
  const secondMover = await UserModel.findOneAndUpdate(
    { email: 'mover2@moveup.tn' },
    {
      $set: {
        passwordHash: await bcrypt.hash('Demo#2026!', 10),
        name: 'Sahel Déménagement',
        phone: '+21697222333',
        role: 'MOVER',
        locale: 'fr',
        status: 'ACTIVE',
      },
      $setOnInsert: { email: 'mover2@moveup.tn' },
    },
    { upsert: true, returnDocument: 'after' },
  ).lean();
  if (!secondMover) throw new Error('Second mover upsert failed');
  await MoverProfileModel.updateOne(
    { userId: String(secondMover._id) },
    {
      $set: {
        companyName: 'Sahel Déménagement',
        zones: ['SOU', 'MON'],
        verificationStatus: 'APPROVED',
      },
      $setOnInsert: { userId: String(secondMover._id) },
    },
    { upsert: true },
  );

  const clientId = String(client._id);
  const moverId = String(mover._id);
  const mover2Id = String(secondMover._id);
  const adminId = String(admin._id);
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

  const claims = [
    {
      reference: 'CLM-DEMO-0001',
      moverId,
      moveReference: 'MV-2026-0142',
      category: 'DAMAGE' as const,
      subject: 'Glass table broken during unloading',
      description:
        'The glass coffee table arrived with a large crack. The crew said it was already damaged but it was fine at pickup. I have photos from before the move.',
      amountClaimed: 450,
      status: 'UNDER_REVIEW' as const,
      created: 3,
    },
    {
      reference: 'CLM-DEMO-0002',
      moverId,
      moveReference: 'MV-2026-0118',
      category: 'DELAY' as const,
      subject: 'Crew arrived three hours late',
      description:
        "L'équipe est arrivée avec 3 heures de retard sans prévenir. J'ai dû prendre un jour de congé supplémentaire.",
      amountClaimed: null,
      status: 'OPEN' as const,
      created: 1,
    },
    {
      reference: 'CLM-DEMO-0003',
      moverId: mover2Id,
      moveReference: 'MV-2026-0097',
      category: 'LOSS' as const,
      subject: 'One box of kitchenware missing',
      description:
        'A box labelled KITCHEN 3 never arrived at the new apartment in Sousse. It contained plates and a coffee machine.',
      amountClaimed: 380,
      status: 'RESOLVED' as const,
      created: 12,
    },
  ];

  for (const claim of claims) {
    const triage = triageClaimByRules({ ...claim, category: claim.category });
    const createdAt = daysAgo(claim.created);
    const isGlassClaim = claim.reference === 'CLM-DEMO-0001';
    const glassPreset = VISION_DEMO_PRESETS[0]!;
    const evidencePhotos = isGlassClaim ? [glassPreset.dataUrl] : [];
    const visionAnalysis = isGlassClaim
      ? {
          ...glassPreset.analysis,
          source: 'rules' as const,
          model: null,
          analyzedAt: createdAt,
        }
      : null;
    const aiMediation = isGlassClaim
      ? {
          ...mediateClaimByRules({
            reference: claim.reference,
            category: claim.category,
            priority: triage.priority,
            subject: claim.subject,
            description: claim.description,
            amountClaimed: claim.amountClaimed,
            moverRatingAvg: 3.5,
            moverClaimsCount: 2,
            visionSeverity: glassPreset.analysis.overallSeverity,
            visionEstimatedCostTnd: glassPreset.analysis.recommendedClaimAmountTnd,
          }),
          source: 'rules' as const,
          model: null,
          generatedAt: createdAt,
        }
      : null;
    const timeline = [
      {
        kind: 'CREATED',
        authorId: clientId,
        authorRole: 'CLIENT',
        text: 'Claim submitted',
        status: 'OPEN',
        createdAt,
      },
    ];
    if (claim.status !== 'OPEN') {
      timeline.push({
        kind: 'STATUS_CHANGED',
        authorId: adminId,
        authorRole: 'ADMIN',
        text: 'We are reviewing your claim with the mover.',
        status: 'UNDER_REVIEW',
        createdAt: daysAgo(claim.created - 1),
      });
      timeline.push({
        kind: 'MESSAGE',
        authorId: claim.moverId,
        authorRole: 'MOVER',
        text: 'We checked with the crew; we will cooperate fully.',
        status: null as never,
        createdAt: daysAgo(claim.created - 1),
      });
    }
    const resolution =
      claim.status === 'RESOLVED'
        ? {
            outcome: 'PARTIAL_REFUND',
            amount: 250,
            note: 'The box was lost in transit. The mover refunds 250 TND (declared value of the coffee machine and plates).',
            resolvedBy: adminId,
            resolvedAt: daysAgo(claim.created - 4),
          }
        : null;
    if (resolution)
      timeline.push({
        kind: 'RESOLUTION',
        authorId: adminId,
        authorRole: 'ADMIN',
        text: resolution.note,
        status: 'RESOLVED',
        createdAt: resolution.resolvedAt,
      });

    await ClaimModel.updateOne(
      { reference: claim.reference },
      {
        $set: {
          clientId,
          moverId: claim.moverId,
          moveReference: claim.moveReference,
          category: claim.category,
          priority: triage.priority,
          status: claim.status,
          subject: claim.subject,
          description: claim.description,
          amountClaimed: claim.amountClaimed,
          evidencePhotos,
          visionAnalysis,
          aiTriage: { ...triage, source: 'rules', model: null, createdAt },
          aiMediation,
          resolution,
          timeline,
          createdAt,
          updatedAt: timeline[timeline.length - 1]?.createdAt ?? createdAt,
        },
      },
      { upsert: true, timestamps: false },
    );
  }

  const reviews = [
    {
      moverId,
      moveReference: 'MV-2026-0101',
      rating: 5,
      punctuality: 5,
      care: 5,
      communication: 4,
      comment: 'Very professional team, on time and careful with fragile items. Highly recommend!',
    },
    {
      moverId,
      moveReference: 'MV-2026-0118',
      rating: 2,
      punctuality: 1,
      care: 3,
      communication: 2,
      comment: 'Three hours late and no call to warn us. The move itself was ok.',
    },
    {
      moverId: mover2Id,
      moveReference: 'MV-2026-0097',
      rating: 3,
      punctuality: 4,
      care: 2,
      communication: 4,
      comment:
        'Équipe sympathique mais un carton a disparu. Le support a bien géré la réclamation.',
    },
    {
      moverId: mover2Id,
      moveReference: 'MV-2026-0150',
      rating: 1,
      punctuality: null,
      care: null,
      communication: null,
      comment: 'Bande de voleurs, appelez-moi au +216 55 123 456 si vous osez',
    },
  ];

  for (const review of reviews) {
    const moderation = moderateReviewByRules(review);
    await ReviewModel.updateOne(
      { clientId, moverId: review.moverId, moveReference: review.moveReference },
      {
        $set: {
          ...review,
          status: moderation.toxic ? 'FLAGGED' : 'PUBLISHED',
          moderation: { ...moderation, source: 'rules', model: null, createdAt: new Date() },
        },
        $setOnInsert: { clientId, moderationNote: null, moderatedBy: null, moverReply: null },
      },
      { upsert: true },
    );
  }

  for (const id of [moverId, mover2Id]) {
    const [row] = await ReviewModel.aggregate<{ avg: number; count: number }>([
      { $match: { moverId: id, status: 'PUBLISHED' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    await MoverProfileModel.updateOne(
      { userId: id },
      { $set: { ratingAvg: row?.avg ?? 0, ratingCount: row?.count ?? 0 } },
    );
  }

  console.log(
    'Quality seed complete: 3 claims, 4 reviews (1 flagged), second mover mover2@moveup.tn.',
  );
}

seedQuality()
  .catch((error) => {
    console.error('Quality seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
