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
import { dispatchMove } from '../mover/mover.dispatch';
import { respondToOffer } from '../mover/mover.offers';
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
 * Seeder playground: fake but coherent data for every module, so each screen
 * can be tested end to end. Everything it creates carries a playground marker
 * (an email domain or a reference prefix), so `reset()` removes exactly that
 * and never touches real or core demo data.
 *
 * Built on the app's own services where a flow exists (bookings, dispatch,
 * offer acceptance, move completion, houses) so the data looks like real use.
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
] as const;

const PLAYGROUND_MOVERS = [
  {
    key: 'carthage',
    name: 'Carthage Move',
    phone: '+21620200001',
    zones: ['SFA'],
    rating: 4.6,
  },
  {
    key: 'cap-bon',
    name: 'Cap Bon Transport',
    phone: '+21620200002',
    zones: ['NAB', 'SOU'],
    rating: 4.1,
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

/** Makes a mover able to receive offers: approved, insured, available for three weeks. */
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
  const insured = await MoverDocumentModel.exists({
    moverId,
    type: 'INSURANCE',
    expiresAt: { $gt: new Date() },
  });
  if (!insured) {
    await MoverDocumentModel.create({
      moverId,
      type: 'INSURANCE',
      storageKey: `${PG.storagePrefix}${moverId}/insurance.pdf`,
      contentType: 'application/pdf',
      fileName: 'insurance-playground.pdf',
      expiresAt: new Date(Date.now() + 200 * DAY_MS),
    });
  }
  for (let offset = 1; offset <= 21; offset += 1) {
    await AvailabilityModel.updateOne(
      { moverId, date: dayFromNow(offset) },
      { $setOnInsert: { slot: 'FULL_DAY' } },
      { upsert: true },
    );
  }
}

async function seedAccounts() {
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
  return { clients, movers };
}

/** The core demo accounts (from `yarn db:seed`); the playground hangs data off them too. */
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

async function allClients(): Promise<Actor[]> {
  const core = await coreAccounts();
  const { clients } = await seedAccounts();
  return [core.client, ...clients];
}

// ── Bookings & live tracking (Move) ──────────────────────────────────────

const ROUTES = [
  ['15 Rue de Marseille, Tunis', '8 Avenue Hedi Chaker, Sfax', 270],
  ['3 Rue Ibn Khaldoun, Ariana', '22 Rue de Rome, Tunis', 9],
  ['Résidence Jasmin, La Marsa', '41 Boulevard 14 Janvier, Sousse', 145],
  ['5 Avenue de France, Tunis', 'Cité El Khadra, Tunis', 6],
] as const;

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
] as const;

/** Stage a booking has reached; earlier stages are marked done. */
const BOOKING_STAGES = ['ASSIGNED', 'EN_ROUTE', 'IN_TRANSIT', 'COMPLETED'] as const;

async function seedBookings() {
  const clients = await allClients();
  let sequence = 0;
  for (const client of clients) {
    for (const stage of BOOKING_STAGES) {
      sequence += 1;
      const reference = `${PG.movePrefix}${String(sequence).padStart(4, '0')}`;
      if (await MoveModel.exists({ reference })) continue;
      const route = ROUTES[sequence % ROUTES.length]!;
      const basket = BASKETS[sequence % BASKETS.length]!;
      const finished = stage === 'COMPLETED';
      const created = await movesService.create(
        {
          pickupAddress: route[0],
          destinationAddress: route[1],
          distance: route[2],
          moveDate: finished ? daysAgo(6).toISOString().slice(0, 10) : dayFromNow(3),
          items: basket.map((item) => ({ ...item })),
        },
        client.id,
      );
      const move = await MoveModel.findOne({ reference: created.reference });
      if (!move) continue;
      const reached = move.stages.findIndex((s) => s.key === stage);
      const now = new Date();
      move.reference = reference;
      move.currentStage = stage;
      move.stages = move.stages.map((s, index) => ({
        ...s,
        completedAt: index <= reached ? (s.completedAt ?? now) : null,
      }));
      await move.save();
    }
  }
}

// ── Mover workspace (MoveRequest → offers → jobs → earnings) ─────────────

const REQUEST_SCENARIOS = [
  { state: 'OFFER', day: 4 },
  { state: 'OFFER', day: 5 },
  { state: 'ASSIGNED', day: 6 },
  { state: 'LOADING', day: 7 },
  { state: 'COMPLETED', day: 8 },
] as const;

async function seedMoverJobs() {
  const core = await coreAccounts();
  const clients = await allClients();
  await makeMoverReady(core.mover.id, ['TUN'], 4.4);

  for (const [index, scenario] of REQUEST_SCENARIOS.entries()) {
    const reference = `${PG.requestPrefix}${String(index + 1).padStart(4, '0')}`;
    if (await MoveRequestModel.exists({ reference })) continue;
    const client = clients[index % clients.length]!;
    const basket = BASKETS[index % BASKETS.length]!;
    const request = await MoveRequestModel.create({
      reference,
      clientId: client.id,
      pickup: {
        street: `${10 + index} Rue de la Liberté`,
        city: 'Tunis',
        zone: 'TUN',
        postalCode: '1002',
        floor: index % 4,
        hasElevator: index % 2 === 0,
      },
      dropoff: {
        street: `${20 + index} Avenue Habib Bourguiba`,
        city: 'Tunis',
        zone: 'TUN',
        postalCode: '1000',
        floor: 1,
        hasElevator: true,
      },
      // Each job on its own day, so the mover has no schedule conflict.
      moveDate: dayFromNow(scenario.day),
      timeSlot: 'MORNING',
      housingType: 'Apartment',
      sizeRooms: 2 + (index % 3),
      volumeM3: 8 + index * 3,
      extraServices: index % 2 === 0 ? ['PACKING'] : [],
      notes: 'Playground request.',
      items: basket.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        category: item.id === 'box' ? 'Boxes' : 'Furniture',
        needsDisassembly: item.id === 'wardrobe' || item.id === 'bed',
      })),
      status: 'SUBMITTED',
      estimatedPrice: 260 + index * 70,
    });
    const moveId = String(request._id);
    await dispatchMove(moveId, { actorId: core.adminId, count: 1 });
    if (scenario.state === 'OFFER') continue;

    const offer = await JobOfferModel.findOne({ moveId, moverId: core.mover.id }).lean();
    if (!offer) continue; // Not eligible (e.g. missing availability): stays an open request.
    await respondToOffer(core.mover.id, String(offer._id), { action: 'ACCEPT' });
    if (scenario.state === 'ASSIGNED') continue;

    // Later job steps need photos in the real flow; the playground jumps there directly.
    const to =
      scenario.state === 'LOADING'
        ? { status: 'IN_PROGRESS', progressStage: 'LOADING' }
        : { status: 'DELIVERED', progressStage: null, deliveredAt: new Date() };
    await MoveRequestModel.updateOne({ _id: moveId }, { $set: to });
    await StatusEventModel.create({
      moveId,
      fromStatus: 'ASSIGNED',
      toStatus: to.status,
      note: 'Playground: advanced for testing.',
      actorId: core.mover.id,
    });
    if (scenario.state === 'COMPLETED') {
      const delivered = await MoveRequestModel.findById(moveId).lean();
      if (delivered)
        await completeMove(delivered, core.adminId, 'Playground: completed.', new Date());
    }
  }
}

// ── Smart rooms (houses + rooms linked to a booking) ─────────────────────

async function seedSmartRooms() {
  await seedBookings();
  const clients = await allClients();
  for (const client of clients.slice(1)) {
    const label = `${PG.homeLabel} ${client.name.split(' ')[0]}`;
    if (await HomeModel.exists({ clientId: client.id, label, deletedAt: null })) continue;
    const move = await MoveModel.findOne({
      clientId: client.id,
      reference: { $regex: `^${PG.movePrefix}` },
      currentStage: { $ne: 'COMPLETED' },
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
    ] as const;
    for (const room of rooms) {
      await homesService.addRoom(ref, home.id, {
        ...room,
        notes: '',
        openings: [{ kind: 'DOOR', wall: 'S', offsetCm: 40, widthCm: 85 }],
      });
    }
    if (move) await homesService.updateMine(ref, home.id, { moveReference: move.reference });
  }
}

// ── Quality (claims & reviews on finished bookings) ──────────────────────

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
] as const;

async function seedQuality() {
  await seedBookings();
  const clients = await allClients();
  let claimNumber = 0;
  for (const [index, client] of clients.entries()) {
    const finished = await MoveModel.findOne({
      clientId: client.id,
      reference: { $regex: `^${PG.movePrefix}` },
      currentStage: 'COMPLETED',
    }).lean();
    if (!finished) continue;
    const moverId = finished.mover.userId;

    const review = REVIEW_TEMPLATES[index % REVIEW_TEMPLATES.length]!;
    const moderation = moderateReviewByRules(review);
    await ReviewModel.updateOne(
      { clientId: client.id, moverId, moveReference: finished.reference },
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

    const template = CLAIM_TEMPLATES[index % CLAIM_TEMPLATES.length]!;
    claimNumber += 1;
    const reference = `${PG.claimPrefix}${String(claimNumber).padStart(4, '0')}`;
    if (await ClaimModel.exists({ reference })) continue;
    const triage = triageClaimByRules(template);
    const createdAt = daysAgo(2 + index);
    await ClaimModel.create({
      reference,
      clientId: client.id,
      moverId,
      moveReference: finished.reference,
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
          authorId: client.id,
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
  mover: seedMoverJobs,
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

/** Removes everything the playground created, and nothing else. */
export async function resetPlayground() {
  await connectMongo();
  const userIds = await playgroundUserIds();
  const requests = await MoveRequestModel.find({ reference: { $regex: `^${PG.requestPrefix}` } })
    .select('_id')
    .lean();
  const requestIds = requests.map((request) => String(request._id));
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
    ReviewModel.deleteMany({ moveReference: { $regex: `^${PG.movePrefix}` } }),
    LayoutPlanModel.deleteMany({ homeId: { $in: homeIds } }),
    HomeModel.deleteMany({ _id: { $in: homeIds } }),
    MoveModel.deleteMany({ reference: { $regex: `^${PG.movePrefix}` } }),
    JobOfferModel.deleteMany({ moveId: { $in: requestIds } }),
    StatusEventModel.deleteMany({ moveId: { $in: requestIds } }),
    EarningModel.deleteMany({ moveId: { $in: requestIds } }),
    MoveRequestModel.deleteMany({ _id: { $in: requestIds } }),
    MoverDocumentModel.deleteMany({ storageKey: { $regex: `^${PG.storagePrefix}` } }),
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
  const requests = await MoveRequestModel.find({ reference: { $regex: `^${PG.requestPrefix}` } })
    .select('_id status')
    .lean();
  const requestIds = requests.map((request) => String(request._id));
  const [clients, movers, bookings, offers, earnings, homes, claims, reviews, employees, leave] =
    await Promise.all([
      UserModel.countDocuments({ _id: { $in: userIds }, role: 'CLIENT' }),
      UserModel.countDocuments({ _id: { $in: userIds }, role: 'MOVER' }),
      MoveModel.countDocuments({ reference: { $regex: `^${PG.movePrefix}` } }),
      JobOfferModel.countDocuments({ moveId: { $in: requestIds }, status: 'PENDING' }),
      EarningModel.countDocuments({ moveId: { $in: requestIds } }),
      HomeModel.countDocuments({ label: { $regex: `^\\${PG.homeLabel}` }, deletedAt: null }),
      ClaimModel.countDocuments({ reference: { $regex: `^${PG.claimPrefix}` } }),
      ReviewModel.countDocuments({ moveReference: { $regex: `^${PG.movePrefix}` } }),
      EmployeeModel.countDocuments({ employeeRef: { $regex: '^PG-EMP-' } }),
      LeaveRequestModel.countDocuments({
        employee: {
          $in: (
            await EmployeeModel.find({ employeeRef: { $regex: '^PG-EMP-' } })
              .select('_id')
              .lean()
          ).map((employee) => employee._id),
        },
      }),
    ]);
  const jobs = requests.filter(
    (request) => request.status !== 'QUOTING' && request.status !== 'SUBMITTED',
  );
  return {
    accounts: { clients, movers },
    bookings: { bookings },
    mover: { requests: requests.length, openOffers: offers, jobs: jobs.length, earnings },
    smartRooms: { houses: homes },
    quality: { claims, reviews },
    hr: { employees, leaveRequests: leave },
  };
}
