import bcrypt from 'bcryptjs';
import { connectMongo } from '../../shared/database/mongoose';
import { BadRequestError } from '../../shared/database/errors';
import {
  AttendanceModel,
  AvailabilityModel,
  EmployeeModel,
  JobOfferModel,
  LeaveRequestModel,
  MoveModel,
  MoveRequestModel,
  MoverDocumentModel,
  MoverProfileModel,
  UserModel,
} from '../../shared/database/models';
import { ClaimModel } from '../../shared/database/models/claim.model';
import { ReviewModel } from '../../shared/database/models/review.model';
import { HomeModel } from '../../shared/database/models/home.model';
import { LayoutPlanModel } from '../../shared/database/models/layout-plan.model';
import { EarningModel } from '../../shared/database/models/earning.model';
import { StatusEventModel } from '../../shared/database/models/status-event.model';
import { QuoteModel } from '../../shared/database/models/quote.model';
import { NotificationModel } from '../../shared/database/models/notification.model';
import { MessageModel } from '../../shared/database/models/message.model';
import { VehicleModel } from '../../shared/database/models/vehicle.model';
import { TeamMemberModel } from '../../shared/database/models/team-member.model';
import { respondToOffer } from '../mover/mover.offers';
import { updateJobStatus } from '../mover/mover.jobs';
import { completeMove } from '../mover/mover.completion';
import { todayInTunis } from '../mover/mover.rules';
import { movesService } from '../moves/moves.service';
import { homesService } from '../homes/homes.service';
import { moderateReviewByRules, triageClaimByRules } from '../ai/ai.fallback';
import {
  PLAYGROUND_DOMAIN,
  PLAYGROUND_MODULES,
  PLAYGROUND_PASSWORD,
  PG,
  type PlaygroundModule,
} from './playground.constants';

/**
 * Seeder playground: lots of fake but coherent data for every module, so each
 * screen can be tested end to end. Bookings go through the real flow — the
 * client books (the request is dispatched to eligible movers), movers accept or
 * quote, report their steps, and the client confirms — so offers, jobs,
 * tracking timelines, earnings, houses, claims and reviews all line up.
 *
 * Everything carries a playground marker (an email domain or a reference
 * prefix), so `resetPlayground()` removes exactly that and nothing else.
 */

const DAY_MS = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);
const dayFromNow = (days: number) => todayInTunis(new Date(Date.now() + days * DAY_MS));

interface Actor {
  id: string;
  email: string;
  name: string;
}

const PLAYGROUND_CLIENTS = [
  { key: 'yasmine', name: 'Yasmine Trabelsi', phone: '+21620100001' },
  { key: 'karim', name: 'Karim Ben Ammar', phone: '+21620100002' },
  { key: 'salma', name: 'Salma Gharbi', phone: '+21620100003' },
  { key: 'mehdi', name: 'Mehdi Jaziri', phone: '+21620100004' },
  { key: 'ines', name: 'Ines Bouzid', phone: '+21620100005' },
  { key: 'omar', name: 'Omar Khelifi', phone: '+21620100006' },
  { key: 'rania', name: 'Rania Saidi', phone: '+21620100007' },
  { key: 'youssef', name: 'Youssef Hammami', phone: '+21620100008' },
] as const;

const PLAYGROUND_MOVERS = [
  { key: 'carthage', name: 'Carthage Move', phone: '+21620200001', zones: ['TUN'], rating: 4.6 },
  { key: 'sfax-express', name: 'Sfax Express', phone: '+21620200002', zones: ['SFA'], rating: 4.3 },
  {
    key: 'sahel-pro',
    name: 'Sahel Pro Moving',
    phone: '+21620200003',
    zones: ['SOU'],
    rating: 4.1,
  },
  {
    key: 'cap-bon',
    name: 'Cap Bon Transport',
    phone: '+21620200004',
    zones: ['NAB', 'BIZ'],
    rating: 3.9,
  },
  {
    key: 'kairouan-move',
    name: 'Kairouan Move',
    phone: '+21620200005',
    zones: ['KAI'],
    rating: 4.0,
  },
] as const;

const email = (key: string) => `${key}@${PLAYGROUND_DOMAIN}`;

// ── Accounts ─────────────────────────────────────────────────────────────

async function upsertUser(
  input: { email: string; name: string; phone: string; role: 'CLIENT' | 'MOVER' },
  passwordHash: string,
): Promise<Actor> {
  const user = await UserModel.findOneAndUpdate(
    { email: input.email },
    {
      $set: { name: input.name, role: input.role, status: 'ACTIVE', deletedAt: null },
      $setOnInsert: { email: input.email, phone: input.phone, passwordHash, locale: 'en' },
    },
    { upsert: true, returnDocument: 'after' },
  ).lean();
  if (!user) throw new Error(`Could not create ${input.email}`);
  return { id: String(user._id), email: input.email, name: input.name };
}

/** Approved, insured and available for the next two months: able to receive offers. */
async function makeMoverReady(moverId: string, zones: readonly string[], rating: number) {
  await MoverProfileModel.updateOne(
    { userId: moverId },
    {
      $set: { verificationStatus: 'APPROVED' },
      $addToSet: { zones: { $each: [...zones] } },
      $setOnInsert: { ratingAvg: rating },
    },
    { upsert: true },
  );
  // A verified file: ID, licence, vehicle registration and insurance, all reviewed.
  for (const type of ['ID', 'LICENCE', 'REGISTRATION', 'INSURANCE'] as const) {
    const valid = await MoverDocumentModel.exists({
      moverId,
      type,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });
    if (valid) continue;
    await MoverDocumentModel.create({
      moverId,
      type,
      storageKey: `${PG.storagePrefix}${moverId}/${type.toLowerCase()}.pdf`,
      contentType: 'application/pdf',
      fileName: `${type.toLowerCase()}-playground.pdf`,
      expiresAt: type === 'ID' ? null : new Date(Date.now() + 200 * DAY_MS),
      reviewedBy: 'playground',
      reviewedAt: new Date(),
    });
  }
  if (!(await VehicleModel.exists({ moverId }))) {
    await VehicleModel.create({
      moverId,
      type: 'VAN',
      capacityM3: 14,
      plate: `PG-${moverId.slice(-6)}`,
    });
  }
  if (!(await TeamMemberModel.exists({ moverId }))) {
    await TeamMemberModel.create([
      { moverId, name: 'Sami Ferchichi', phone: '+21622300401', role: 'Driver (playground)' },
      { moverId, name: 'Walid Mansour', phone: '+21622300402', role: 'Helper (playground)' },
    ]);
  }
  await AvailabilityModel.bulkWrite(
    Array.from({ length: 60 }, (_, index) => ({
      updateOne: {
        filter: { moverId, date: dayFromNow(index + 1) },
        update: { $setOnInsert: { slot: 'FULL_DAY' } },
        upsert: true,
      },
    })),
  );
}

async function coreAccounts() {
  const [client, mover, admin] = await Promise.all([
    UserModel.findOne({ email: 'client@moveup.tn' }).lean(),
    UserModel.findOne({ email: 'mover@moveup.tn' }).lean(),
    UserModel.findOne({ email: 'admin@moveup.tn' }).lean(),
  ]);
  if (!client || !mover || !admin) {
    throw new BadRequestError('Run `yarn db:seed` first: the demo accounts are missing.');
  }
  return {
    client: { id: String(client._id), email: client.email, name: client.name } as Actor,
    mover: { id: String(mover._id), email: mover.email, name: mover.name } as Actor,
    adminId: String(admin._id),
  };
}

async function seedAccounts() {
  const core = await coreAccounts();
  const passwordHash = await bcrypt.hash(PLAYGROUND_PASSWORD, 10);
  const clients: Actor[] = [];
  for (const client of PLAYGROUND_CLIENTS) {
    clients.push(
      await upsertUser(
        { email: email(client.key), name: client.name, phone: client.phone, role: 'CLIENT' },
        passwordHash,
      ),
    );
  }
  const movers: Actor[] = [];
  for (const mover of PLAYGROUND_MOVERS) {
    const actor = await upsertUser(
      { email: email(mover.key), name: mover.name, phone: mover.phone, role: 'MOVER' },
      passwordHash,
    );
    await MoverProfileModel.updateOne(
      { userId: actor.id },
      { $set: { companyName: mover.name }, $setOnInsert: { bio: 'Playground mover.' } },
      { upsert: true },
    );
    await makeMoverReady(actor.id, mover.zones, mover.rating);
    movers.push(actor);
  }
  // The demo mover gets work too, so mover@moveup.tn has a full workspace.
  await makeMoverReady(core.mover.id, ['TUN'], 4.4);
  return { core, clients: [core.client, ...clients], movers };
}

// ── Bookings → mover offers, quotes, jobs, tracking, earnings ────────────

const CITIES: Record<string, { city: string; streets: string[] }> = {
  TUN: {
    city: 'Tunis',
    streets: [
      '15 Rue de Marseille',
      '3 Avenue de Paris',
      'Résidence Jasmin, Lac 2',
      '22 Rue de Rome',
      'Cité El Khadra',
    ],
  },
  SFA: {
    city: 'Sfax',
    streets: ['8 Avenue Hedi Chaker', 'Route de Tunis km 4', '41 Rue Habib Maazoun'],
  },
  SOU: { city: 'Sousse', streets: ['12 Boulevard 14 Janvier', 'Sahloul 3', 'Rue de Monastir'] },
  NAB: { city: 'Nabeul', streets: ['5 Avenue Farhat Hached', 'Rue des Potiers'] },
  BIZ: { city: 'Bizerte', streets: ['27 Rue de Carthage', 'Corniche de Bizerte'] },
  KAI: { city: 'Kairouan', streets: ['Avenue de la République', 'Rue Okba Ibn Nafaa'] },
};

const BASKETS = [
  [
    { id: 'sofa', name: '3-Seater Sofa', volume: 1.6, weight: 65, quantity: 1 },
    { id: 'bed', name: 'Double Bed', volume: 1.8, weight: 55, quantity: 1 },
    { id: 'box', name: 'Moving box', volume: 0.08, weight: 12, quantity: 15 },
  ],
  [
    { id: 'fridge', name: 'Fridge / Freezer', volume: 1.1, weight: 85, quantity: 1 },
    { id: 'washer', name: 'Washing machine', volume: 0.65, weight: 72, quantity: 1 },
    { id: 'box', name: 'Moving box', volume: 0.08, weight: 12, quantity: 8 },
  ],
  [
    { id: 'wardrobe', name: 'Wardrobe (2 doors)', volume: 1.4, weight: 70, quantity: 2 },
    { id: 'table', name: 'Dining Table', volume: 1.25, weight: 35, quantity: 1 },
    { id: 'chair', name: 'Chair / Armchair', volume: 0.18, weight: 8, quantity: 4 },
  ],
  [
    { id: 'desk', name: 'Office desk', volume: 0.6, weight: 30, quantity: 2 },
    { id: 'chair', name: 'Chair / Armchair', volume: 0.18, weight: 8, quantity: 2 },
    { id: 'box', name: 'Moving box', volume: 0.08, weight: 12, quantity: 20 },
  ],
] as const;

/** Where a playground booking ends up; each one runs the real flow up to there. */
const TARGETS = [
  'OFFER',
  'QUOTE',
  'ASSIGNED',
  'EN_ROUTE',
  'LOADING',
  'IN_TRANSIT',
  'DELIVERED',
  'COMPLETED',
] as const;
type Target = (typeof TARGETS)[number];
const ZONE_ORDER = ['TUN', 'SFA', 'SOU', 'NAB', 'BIZ', 'KAI', 'TUN', 'TUN'];
const BOOKINGS_PER_CLIENT = 5;

async function event(moveId: string, from: string, to: string, note: string, actorId: string) {
  await StatusEventModel.create({ moveId, fromStatus: from, toStatus: to, note, actorId });
}

/** Drives one dispatched request up to its target, through the mover-side services. */
async function driveTo(moveId: string, target: Target, adminId: string) {
  if (target === 'OFFER') return;
  const offer = await JobOfferModel.findOne({ moveId, status: 'PENDING' }).lean();
  if (!offer) return; // No eligible mover that day: it stays an open request.
  const moverId = offer.moverId;
  if (target === 'QUOTE') {
    const move = await MoveRequestModel.findById(moveId).lean();
    const amount = Math.round((move?.estimatedPrice ?? 300) * 1.12);
    await respondToOffer(moverId, String(offer._id), {
      action: 'QUOTE',
      amount,
      message: 'Includes two extra helpers for the stairs.',
    });
    return;
  }
  await respondToOffer(moverId, String(offer._id), { action: 'ACCEPT' });
  if (target === 'ASSIGNED') return;
  await updateJobStatus(moverId, moveId, 'EN_ROUTE');
  if (target === 'EN_ROUTE') return;
  await updateJobStatus(moverId, moveId, 'LOADING');
  if (target === 'LOADING') return;

  // Leaving with the load needs photos and a load check in the real app;
  // the playground records the steps directly.
  await MoveRequestModel.updateOne({ _id: moveId }, { $set: { progressStage: 'IN_TRANSIT' } });
  await event(moveId, 'IN_PROGRESS', 'IN_PROGRESS', 'In transit (playground)', moverId);
  if (target === 'IN_TRANSIT') return;
  await MoveRequestModel.updateOne(
    { _id: moveId },
    { $set: { status: 'DELIVERED', progressStage: null, deliveredAt: new Date() } },
  );
  await event(moveId, 'IN_PROGRESS', 'DELIVERED', 'Delivered (playground)', moverId);
  if (target === 'DELIVERED') return;
  const delivered = await MoveRequestModel.findById(moveId).lean();
  if (delivered)
    await completeMove(delivered, adminId, 'Client confirmed delivery (playground)', new Date());
}

async function seedBookings() {
  const { core, clients } = await seedAccounts();
  // Re-running the playground also refreshes its still-open offers.
  const openRequests = await MoveRequestModel.find({
    reference: { $regex: `^${PG.movePrefix}` },
    status: { $in: ['SUBMITTED', 'QUOTING'] },
  })
    .select('_id')
    .lean();
  await JobOfferModel.updateMany(
    {
      moveId: { $in: openRequests.map((request) => String(request._id)) },
      status: 'PENDING',
    },
    { $set: { expiresAt: new Date(Date.now() + 7 * DAY_MS) } },
  );
  let sequence = 0;
  for (const [clientIndex, client] of clients.entries()) {
    for (let slot = 0; slot < BOOKINGS_PER_CLIENT; slot += 1) {
      sequence += 1;
      const reference = `${PG.movePrefix}${String(sequence).padStart(4, '0')}`;
      if (await MoveRequestModel.exists({ reference })) continue;
      const target = TARGETS[(clientIndex * BOOKINGS_PER_CLIENT + slot) % TARGETS.length]!;
      const zone = ZONE_ORDER[(clientIndex + slot) % ZONE_ORDER.length]!;
      const place = CITIES[zone]!;
      const basket = BASKETS[(clientIndex + slot) % BASKETS.length]!;
      const pickup = `${place.streets[slot % place.streets.length]}, ${place.city}`;
      const dropoff = `${place.streets[(slot + 1) % place.streets.length]}, ${place.city}`;
      const finished = target === 'DELIVERED' || target === 'COMPLETED';
      // One day per booking, so no mover is booked twice on the same day.
      const booked = await movesService.create(
        {
          pickupAddress: pickup,
          destinationAddress: dropoff,
          distance: 4 + ((sequence * 7) % 40),
          moveDate: dayFromNow(sequence + 1),
          timeSlot: slot % 2 === 0 ? 'MORNING' : 'AFTERNOON',
          pickup: { city: place.city, zone, floor: slot % 4, hasElevator: slot % 3 === 0 },
          dropoff: { city: place.city, zone, floor: (slot + 2) % 5, hasElevator: slot % 2 === 0 },
          housingType: slot % 2 === 0 ? 'Apartment' : 'House',
          sizeRooms: 2 + (slot % 3),
          items: basket.map((item) => ({ ...item })),
        },
        client.id,
      );
      await MoveRequestModel.updateOne({ _id: booked.id }, { $set: { reference } });
      // Real offers expire after OFFER_TTL_MINUTES (2 h) and pass to the next mover;
      // playground offers stay open for a week so the demo data does not drain away.
      await JobOfferModel.updateMany(
        { moveId: booked.id, status: 'PENDING' },
        { $set: { expiresAt: new Date(Date.now() + 7 * DAY_MS) } },
      );
      await driveTo(booked.id, target, core.adminId);
      if (finished) {
        // Finished moves happened in the past.
        await MoveRequestModel.updateOne(
          { _id: booked.id },
          { $set: { moveDate: todayInTunis(daysAgo(3 + sequence)) } },
        );
      }
    }
  }
}

// ── Smart rooms (a house per client, linked to an active booking) ────────

async function seedSmartRooms() {
  await seedBookings();
  const { clients } = await seedAccounts();
  for (const client of clients.slice(1)) {
    const label = `${PG.homeLabel} ${client.name.split(' ')[0]}`;
    if (await HomeModel.exists({ clientId: client.id, label, deletedAt: null })) continue;
    const linked = await HomeModel.distinct('moveReference', {
      clientId: client.id,
      deletedAt: null,
    });
    const request = await MoveRequestModel.findOne({
      clientId: client.id,
      reference: { $regex: `^${PG.movePrefix}`, $nin: linked },
      status: { $nin: ['COMPLETED', 'CANCELLED'] },
    }).lean();
    const ref = { id: client.id };
    const home = await homesService.createMine(ref, {
      label,
      city: 'Tunis',
      type: 'APARTMENT',
      floor: 1,
      hasElevator: false,
      notes: 'Playground house.',
    });
    const rooms = [
      { name: 'Living room', type: 'LIVING', widthCm: 480, lengthCm: 420 },
      { name: 'Bedroom', type: 'BEDROOM', widthCm: 380, lengthCm: 360 },
      { name: 'Kitchen', type: 'KITCHEN', widthCm: 300, lengthCm: 280 },
      { name: 'Office', type: 'OFFICE', widthCm: 300, lengthCm: 260 },
    ] as const;
    for (const room of rooms) {
      await homesService.addRoom(ref, home.id, {
        ...room,
        notes: '',
        openings: [
          { kind: 'DOOR', wall: 'S', offsetCm: 40, widthCm: 85 },
          { kind: 'WINDOW', wall: 'N', offsetCm: 80, widthCm: 120 },
        ],
      });
    }
    if (request) await homesService.updateMine(ref, home.id, { moveReference: request.reference });
  }
}

// ── Quality (claims & reviews on completed bookings) ─────────────────────

const CLAIM_TEMPLATES = [
  {
    category: 'DAMAGE',
    subject: 'Scratched wardrobe door',
    description: 'The left door of the wardrobe has a deep scratch that was not there before.',
    amountClaimed: 180,
    status: 'OPEN',
  },
  {
    category: 'DELAY',
    subject: 'Crew arrived two hours late',
    description: 'The crew arrived two hours after the booked slot without calling.',
    amountClaimed: null,
    status: 'UNDER_REVIEW',
  },
  {
    category: 'LOSS',
    subject: 'One box of books missing',
    description: 'A box labelled BOOKS 2 never arrived at the new flat.',
    amountClaimed: 120,
    status: 'OPEN',
  },
] as const;

const REVIEW_TEMPLATES = [
  {
    rating: 5,
    punctuality: 5,
    care: 5,
    communication: 5,
    comment: 'Fast, careful and friendly. Would book again.',
  },
  {
    rating: 4,
    punctuality: 4,
    care: 5,
    communication: 3,
    comment: 'Good job overall, a bit hard to reach by phone.',
  },
  {
    rating: 3,
    punctuality: 2,
    care: 4,
    communication: 3,
    comment: 'Late start but nothing was damaged.',
  },
  {
    rating: 2,
    punctuality: 2,
    care: 2,
    communication: 3,
    comment: 'Two boxes were dented and the crew was rushed.',
  },
  {
    rating: 5,
    punctuality: 5,
    care: 4,
    communication: 5,
    comment: 'Very professional, they even reassembled the bed.',
  },
] as const;

async function seedQuality() {
  await seedBookings();
  const completed = await MoveRequestModel.find({
    reference: { $regex: `^${PG.movePrefix}` },
    status: 'COMPLETED',
    assignedMoverId: { $ne: null },
  }).lean();
  let claimNumber = 0;
  for (const [index, request] of completed.entries()) {
    const moverId = request.assignedMoverId!;
    const review = REVIEW_TEMPLATES[index % REVIEW_TEMPLATES.length]!;
    const moderation = moderateReviewByRules(review);
    await ReviewModel.updateOne(
      { clientId: request.clientId, moverId, moveReference: request.reference },
      {
        $set: {
          ...review,
          status: moderation.toxic ? 'FLAGGED' : 'PUBLISHED',
          moderation: { ...moderation, source: 'rules', model: null, createdAt: new Date() },
        },
        $setOnInsert: { moderationNote: null, moderatedBy: null, moverReply: null },
      },
      { upsert: true },
    );

    // A claim on two completed bookings out of three.
    if (index % 3 === 2) continue;
    const template = CLAIM_TEMPLATES[index % CLAIM_TEMPLATES.length]!;
    claimNumber += 1;
    const reference = `${PG.claimPrefix}${String(claimNumber).padStart(4, '0')}`;
    if (await ClaimModel.exists({ reference })) continue;
    const triage = triageClaimByRules(template);
    const createdAt = daysAgo(1 + (index % 6));
    await ClaimModel.create({
      reference,
      clientId: request.clientId,
      moverId,
      moveReference: request.reference,
      category: template.category,
      priority: triage.priority,
      status: template.status,
      subject: template.subject,
      description: template.description,
      amountClaimed: template.amountClaimed,
      evidencePhotos: [],
      visionAnalysis: null,
      aiTriage: { ...triage, source: 'rules', model: null, createdAt },
      aiMediation: null,
      resolution: null,
      timeline: [
        {
          kind: 'CREATED',
          authorId: request.clientId,
          authorRole: 'CLIENT',
          text: 'Claim submitted',
          status: 'OPEN',
          createdAt,
        },
      ],
      createdAt,
      updatedAt: createdAt,
    });
  }

  // Keep the movers' public rating in step with the reviews.
  const moverIds = await ReviewModel.distinct('moverId');
  for (const moverId of moverIds) {
    const [row] = await ReviewModel.aggregate<{ avg: number; count: number }>([
      { $match: { moverId, status: 'PUBLISHED' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    await MoverProfileModel.updateOne(
      { userId: moverId },
      { $set: { ratingAvg: row?.avg ?? 0, ratingCount: row?.count ?? 0 } },
    );
  }
}

// ── HR (employees, two weeks of attendance, leave) ───────────────────────

const PLAYGROUND_STAFF = [
  { ref: 'PG-EMP-001', name: 'Nour Jebali', role: 'employee' },
  { ref: 'PG-EMP-002', name: 'Hamza Sassi', role: 'employee' },
  { ref: 'PG-EMP-003', name: 'Ines Mrad', role: 'manager' },
] as const;

async function seedHr() {
  const hr = await UserModel.findOne({ email: 'hr@moveup.tn' }).lean();
  if (!hr) throw new BadRequestError('Run `yarn db:seed` first: the HR account is missing.');
  const organization = String(hr._id);

  for (const [index, member] of PLAYGROUND_STAFF.entries()) {
    const employee = await EmployeeModel.findOneAndUpdate(
      { employeeRef: member.ref },
      {
        $set: { fullName: member.name, role: member.role, status: 'active', organization },
        $setOnInsert: {
          employeeRef: member.ref,
          email: email(member.ref.toLowerCase()),
          hireDate: daysAgo(400 + index * 90),
        },
      },
      { upsert: true, returnDocument: 'after' },
    ).lean();
    if (!employee) continue;

    // Ten working days of attendance, with a late day and an absence for realism.
    for (let offset = 14; offset >= 1; offset -= 1) {
      const day = daysAgo(offset);
      if (day.getDay() === 0 || day.getDay() === 6) continue;
      const workDate = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()));
      const status =
        (offset + index) % 9 === 0 ? 'absent' : (offset + index) % 5 === 0 ? 'late' : 'present';
      const clockIn = new Date(workDate.getTime() + (status === 'late' ? 9.5 : 8) * 3_600_000);
      await AttendanceModel.updateOne(
        { employee: employee._id, workDate },
        {
          $setOnInsert: {
            status,
            ...(status === 'absent'
              ? {}
              : { clockIn, clockOut: new Date(clockIn.getTime() + 8 * 3_600_000) }),
          },
        },
        { upsert: true },
      );
    }

    const leaveStart = new Date(Date.now() + (5 + index * 4) * DAY_MS);
    await LeaveRequestModel.updateOne(
      { employee: employee._id, startDate: { $gte: daysAgo(1) } },
      {
        $setOnInsert: {
          type: index === 1 ? 'sick' : 'annual',
          startDate: leaveStart,
          endDate: new Date(leaveStart.getTime() + 2 * DAY_MS),
          daysRequested: 3,
          status: index === 2 ? 'approved' : 'pending',
          reason: 'Playground leave request.',
        },
      },
      { upsert: true },
    );
  }
}

// ── Public API ───────────────────────────────────────────────────────────

const SEEDERS: Record<PlaygroundModule, () => Promise<unknown>> = {
  accounts: seedAccounts,
  bookings: seedBookings,
  smartRooms: seedSmartRooms,
  quality: seedQuality,
  hr: seedHr,
};

export async function seedPlayground(modules: PlaygroundModule[] = [...PLAYGROUND_MODULES]) {
  await connectMongo();
  for (const name of PLAYGROUND_MODULES) {
    if (modules.includes(name)) await SEEDERS[name]();
  }
  return playgroundStatus();
}

async function playgroundUserIds(): Promise<string[]> {
  const users = await UserModel.find({
    email: { $regex: `@${PLAYGROUND_DOMAIN.replace('.', '\\.')}$` },
  })
    .select('_id')
    .lean();
  return users.map((user) => String(user._id));
}

const PG_REQUEST = { $regex: `^(${PG.movePrefix}|${PG.requestPrefix})` };

/** Removes everything the playground created, and nothing else. */
export async function resetPlayground() {
  await connectMongo();
  const userIds = await playgroundUserIds();
  const requests = await MoveRequestModel.find({ reference: PG_REQUEST }).select('_id').lean();
  const requestIds = requests.map((request) => String(request._id));
  const offers = await JobOfferModel.find({ moveId: { $in: requestIds } })
    .select('_id')
    .lean();
  const links = [
    ...offers.map((offer) => `/mover/offers/${String(offer._id)}`),
    ...requestIds.map((id) => `/mover/jobs/${id}`),
  ];
  const homes = await HomeModel.find({ label: { $regex: `^\\${PG.homeLabel}` } })
    .select('_id')
    .lean();
  const homeIds = homes.map((home) => String(home._id));
  const employees = await EmployeeModel.find({ employeeRef: { $regex: '^PG-EMP-' } })
    .select('_id')
    .lean();
  const employeeIds = employees.map((employee) => employee._id);

  await Promise.all([
    ClaimModel.deleteMany({ reference: { $regex: `^${PG.claimPrefix}` } }),
    ReviewModel.deleteMany({ moveReference: PG_REQUEST }),
    LayoutPlanModel.deleteMany({ homeId: { $in: homeIds } }),
    HomeModel.deleteMany({ _id: { $in: homeIds } }),
    MoveModel.deleteMany({ reference: { $regex: `^${PG.movePrefix}` } }),
    JobOfferModel.deleteMany({ moveId: { $in: requestIds } }),
    QuoteModel.deleteMany({ moveId: { $in: requestIds } }),
    MessageModel.deleteMany({ moveId: { $in: requestIds } }),
    StatusEventModel.deleteMany({ moveId: { $in: requestIds } }),
    EarningModel.deleteMany({ moveId: { $in: requestIds } }),
    NotificationModel.deleteMany({ link: { $in: links } }),
    MoveRequestModel.deleteMany({ _id: { $in: requestIds } }),
    MoverDocumentModel.deleteMany({ storageKey: { $regex: `^${PG.storagePrefix}` } }),
    VehicleModel.deleteMany({ plate: { $regex: '^PG-' } }),
    TeamMemberModel.deleteMany({ role: { $regex: '\\(playground\\)$' } }),
    AvailabilityModel.deleteMany({ moverId: { $in: userIds } }),
    MoverProfileModel.deleteMany({ userId: { $in: userIds } }),
    AttendanceModel.deleteMany({ employee: { $in: employeeIds } }),
    LeaveRequestModel.deleteMany({ employee: { $in: employeeIds } }),
    EmployeeModel.deleteMany({ _id: { $in: employeeIds } }),
    UserModel.deleteMany({ _id: { $in: userIds } }),
  ]);
  return playgroundStatus();
}

export type PlaygroundStatus = Record<PlaygroundModule, Record<string, number>>;

/** What the playground currently has in the database, per module. */
export async function playgroundStatus(): Promise<PlaygroundStatus> {
  await connectMongo();
  const userIds = await playgroundUserIds();
  const requests = await MoveRequestModel.find({ reference: PG_REQUEST })
    .select('_id status')
    .lean();
  const requestIds = requests.map((request) => String(request._id));
  const byStatus = (statuses: string[]) =>
    requests.filter((request) => statuses.includes(request.status)).length;
  const employeeIds = (
    await EmployeeModel.find({ employeeRef: { $regex: '^PG-EMP-' } })
      .select('_id')
      .lean()
  ).map((employee) => employee._id);
  const [clients, movers, offers, quotes, earnings, homes, claims, reviews, employees, leave] =
    await Promise.all([
      UserModel.countDocuments({ _id: { $in: userIds }, role: 'CLIENT' }),
      UserModel.countDocuments({ _id: { $in: userIds }, role: 'MOVER' }),
      JobOfferModel.countDocuments({ moveId: { $in: requestIds }, status: 'PENDING' }),
      QuoteModel.countDocuments({ moveId: { $in: requestIds }, status: 'SENT' }),
      EarningModel.countDocuments({ moveId: { $in: requestIds } }),
      HomeModel.countDocuments({ label: { $regex: `^\\${PG.homeLabel}` }, deletedAt: null }),
      ClaimModel.countDocuments({ reference: { $regex: `^${PG.claimPrefix}` } }),
      ReviewModel.countDocuments({ moveReference: PG_REQUEST }),
      EmployeeModel.countDocuments({ _id: { $in: employeeIds } }),
      LeaveRequestModel.countDocuments({ employee: { $in: employeeIds } }),
    ]);
  return {
    accounts: { clients, movers },
    bookings: {
      bookings: requests.length,
      openOffers: offers,
      quotes,
      active: byStatus(['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS']),
      delivered: byStatus(['DELIVERED']),
      completed: byStatus(['COMPLETED']),
      earnings,
    },
    smartRooms: { houses: homes },
    quality: { claims, reviews },
    hr: { employees, leaveRequests: leave },
  };
}
