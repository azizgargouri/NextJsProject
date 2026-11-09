import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectMongo } from './shared/database/mongoose';
import {
  AvailabilityModel,
  EarningModel,
  JobOfferModel,
  MessageModel,
  MoveRequestModel,
  MoverDocumentModel,
  MoverProfileModel,
  NotificationModel,
  PayoutModel,
  PhotoModel,
  QuoteModel,
  StatusEventModel,
  TeamMemberModel,
  UserModel,
  VehicleModel,
} from './shared/database/models';
import { dispatchMove } from './modules/mover/mover.dispatch';
import { completeMove } from './modules/mover/mover.completion';
import { newMoveReference, respondToOffer } from './modules/mover/mover.offers';
import { addJobPhoto, confirmLoad, updateJobStatus, sendMessage } from './modules/mover/mover.jobs';
import { uploadDocument } from './modules/mover/mover.profile';
import { todayInTunis } from './modules/mover/mover.rules';

try {
  process.loadEnvFile();
} catch {
  // Missing .env: fall back to the caller's own environment.
}

/**
 * Test accounts for working on the mover workspace without the admin back
 * office: mover.test@moveup.tn is seeded as already APPROVED, which skips admin
 * review on purpose. Re-running resets these accounts and their moves only;
 * nothing else in the database is read or changed. Never runs in production.
 */
const PASSWORD = 'Demo#2026!';
const DAY_MS = 24 * 60 * 60 * 1000;
const day = (offset: number) => todayInTunis(new Date(Date.now() + offset * DAY_MS));
const TINY_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]);
const TINY_PDF = new TextEncoder().encode('%PDF-1.4\n% MoveUp test document, not a real file\n');

const ACCOUNTS = [
  { email: 'mover.test@moveup.tn', name: 'Test Mover', phone: '+21620000001', role: 'MOVER' },
  { email: 'mover.backup@moveup.tn', name: 'Backup Mover', phone: '+21620000002', role: 'MOVER' },
  { email: 'mover.pending@moveup.tn', name: 'Pending Mover', phone: '+21620000003', role: 'MOVER' },
  {
    email: 'mover.rejected@moveup.tn',
    name: 'Rejected Mover',
    phone: '+21620000004',
    role: 'MOVER',
  },
  { email: 'client.test@moveup.tn', name: 'Test Client', phone: '+21620000005', role: 'CLIENT' },
] as const;

async function upsertAccount(account: (typeof ACCOUNTS)[number], passwordHash: string) {
  const doc = await UserModel.findOneAndUpdate(
    { email: account.email },
    {
      $set: {
        name: account.name,
        phone: account.phone,
        role: account.role,
        passwordHash,
        status: 'ACTIVE',
        locale: 'en',
        deletedAt: null,
      },
      $setOnInsert: { email: account.email },
    },
    { upsert: true, returnDocument: 'after' },
  );
  if (!doc) throw new Error(`Upsert failed for ${account.email}`);
  return String(doc._id);
}

/** Removes only what belongs to these test accounts, so a re-run starts clean. */
async function clearTestData(moverIds: string[], clientId: string) {
  const moves = await MoveRequestModel.find({ clientId }).select('_id').lean();
  const moveIds = moves.map((move) => String(move._id));
  await Promise.all([
    JobOfferModel.deleteMany({ moveId: { $in: moveIds } }),
    QuoteModel.deleteMany({ moveId: { $in: moveIds } }),
    StatusEventModel.deleteMany({ moveId: { $in: moveIds } }),
    MessageModel.deleteMany({ moveId: { $in: moveIds } }),
    PhotoModel.deleteMany({ moveId: { $in: moveIds } }),
    EarningModel.deleteMany({ moveId: { $in: moveIds } }),
    MoveRequestModel.deleteMany({ clientId }),
    NotificationModel.deleteMany({ userId: { $in: [...moverIds, clientId] } }),
    AvailabilityModel.deleteMany({ moverId: { $in: moverIds } }),
    VehicleModel.deleteMany({ moverId: { $in: moverIds } }),
    TeamMemberModel.deleteMany({ moverId: { $in: moverIds } }),
    MoverDocumentModel.deleteMany({ moverId: { $in: moverIds } }),
    PayoutModel.deleteMany({ moverId: { $in: moverIds } }),
  ]);
}

function address(street: string, city: string, zone: string, floor: number, hasElevator: boolean) {
  return { street, city, zone, postalCode: '1000', floor, hasElevator, accessNotes: 'TEST DATA' };
}

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to create approval-skipping test accounts in production');
  }
  await connectMongo();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [mover, backup, pending, rejected, clientId] = (await Promise.all(
    ACCOUNTS.map((account) => upsertAccount(account, passwordHash)),
  )) as [string, string, string, string, string];

  await clearTestData([mover, backup, pending, rejected], clientId);

  const profile = async (
    userId: string,
    companyName: string,
    verificationStatus: string,
    ratingAvg: number,
  ) =>
    MoverProfileModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          companyName,
          bio: 'Test account.',
          taxId: '',
          zones: ['TUN', 'SOU'],
          verificationStatus,
          ratingAvg,
          ratingCount: 0,
        },
        $setOnInsert: { userId },
      },
      { upsert: true },
    );
  await profile(mover, 'Test Mover Transport', 'APPROVED', 4.8);
  await profile(backup, 'Backup Mover Transport', 'APPROVED', 4.2);
  await profile(pending, 'Pending Mover Transport', 'PENDING', 0);
  await profile(rejected, 'Rejected Mover Transport', 'REJECTED', 0);

  // Insurance at 25 days, so the 30-day warning is visible straight away.
  await uploadDocument(mover, 'INSURANCE', day(25), {
    bytes: TINY_PDF,
    name: 'test-insurance.pdf',
  });
  await uploadDocument(mover, 'LICENCE', undefined, { bytes: TINY_PDF, name: 'test-licence.pdf' });
  await uploadDocument(backup, 'INSURANCE', day(300), {
    bytes: TINY_PDF,
    name: 'test-insurance.pdf',
  });
  await VehicleModel.create({ moverId: mover, type: 'VAN', capacityM3: 14, plate: '200 TUN 1234' });
  await TeamMemberModel.create({
    moverId: mover,
    name: 'Test Helper',
    phone: '+21620000009',
    role: 'Loader',
  });

  const openDays = Array.from({ length: 30 }, (_, index) => day(index + 1));
  await AvailabilityModel.insertMany(
    [mover, backup].flatMap((moverId) =>
      openDays.map((date) => ({ moverId, date, slot: 'FULL_DAY' })),
    ),
  );

  const newMove = async (overrides: Record<string, unknown>) =>
    String(
      (
        await MoveRequestModel.create({
          reference: newMoveReference(),
          clientId,
          pickup: address('12 Rue de Test', 'Tunis', 'TUN', 3, false),
          dropoff: address('45 Avenue de Test', 'Sousse', 'SOU', 1, true),
          timeSlot: 'MORNING',
          housingType: 'Apartment',
          sizeRooms: 3,
          volumeM3: 18,
          extraServices: ['PACKING'],
          notes: 'Test data: please call before arriving.',
          items: [
            { name: 'Sofa', quantity: 1, category: 'Furniture', needsDisassembly: true },
            { name: 'Glass table', quantity: 1, category: 'Furniture', isFragile: true },
            { name: 'Boxes', quantity: 20, category: 'Boxes' },
          ],
          status: 'SUBMITTED',
          ...overrides,
        })
      )._id,
    );

  // Open offers: one fixed price, one quote-only, one about to expire.
  await dispatchMove(await newMove({ moveDate: day(5), estimatedPrice: 420 }), { actorId: null });
  await dispatchMove(
    await newMove({ moveDate: day(6), timeSlot: 'AFTERNOON', estimatedPrice: null, volumeM3: 30 }),
    { actorId: null },
  );
  const shortMove = await newMove({
    moveDate: day(8),
    estimatedPrice: 260,
    volumeM3: 9,
    sizeRooms: 1,
  });
  await dispatchMove(shortMove, { actorId: null });
  await JobOfferModel.updateOne(
    { moveId: shortMove, moverId: mover },
    { $set: { expiresAt: new Date(Date.now() + 3 * 60 * 1000) } },
  );

  const accepted = async (overrides: Record<string, unknown>) => {
    const moveId = await newMove(overrides);
    await dispatchMove(moveId, { actorId: null });
    const offer = await JobOfferModel.findOne({ moveId, moverId: mover }).lean();
    if (!offer) throw new Error('Expected an offer for the test mover');
    await respondToOffer(mover, String(offer._id), { action: 'ACCEPT' });
    return moveId;
  };

  await accepted({ moveDate: day(3), estimatedPrice: 380 });

  const liveJob = await accepted({ moveDate: day(1), estimatedPrice: 510 });
  await updateJobStatus(mover, liveJob, 'EN_ROUTE');
  await sendMessage(
    { sub: clientId, role: 'CLIENT' },
    liveJob,
    'MOVER_CLIENT',
    'Test message: the parking entrance is on the left.',
  );

  // Completed jobs and one payout, so the earnings screen has something to show.
  const finish = async (moveId: string) => {
    await updateJobStatus(mover, moveId, 'EN_ROUTE');
    await updateJobStatus(mover, moveId, 'LOADING');
    for (let angle = 0; angle < 4; angle += 1) {
      await addJobPhoto(mover, moveId, 'LOAD', TINY_JPEG);
    }
    await confirmLoad(mover, moveId, { boxes: 20, furniture: 2, confirmed: true });
    await updateJobStatus(mover, moveId, 'IN_TRANSIT');
    await addJobPhoto(mover, moveId, 'DELIVERY', TINY_JPEG);
    await updateJobStatus(mover, moveId, 'DELIVERED');
    const move = await MoveRequestModel.findById(moveId).lean();
    if (move) await completeMove(move, clientId, 'Client confirmed delivery', new Date());
  };
  const paid = await accepted({ moveDate: day(10), estimatedPrice: 300 });
  await finish(paid);
  await finish(await accepted({ moveDate: day(11), estimatedPrice: 450 }));
  const paidEarning = await EarningModel.findOne({ moveId: paid }).lean();
  if (paidEarning) {
    const payout = await PayoutModel.create({
      moverId: mover,
      amount: paidEarning.net,
      method: 'TRANSFER',
      reference: 'TEST-PAYOUT-001',
      paidAt: new Date(),
    });
    await EarningModel.updateOne(
      { _id: paidEarning._id },
      { $set: { status: 'PAID', payoutId: String(payout._id) } },
    );
  }

  console.log(`Mover test data ready. Password for every account: ${PASSWORD}`);
  for (const account of ACCOUNTS) console.log(`  ${account.email} (${account.role})`);
}

seed()
  .catch((error) => {
    console.error('Mover seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
