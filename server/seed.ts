import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectMongo } from './shared/database/mongoose';
import { UserModel } from './shared/database/models/user.model';
import { MoverProfileModel } from './shared/database/models/mover-profile.model';
import { EmployeeModel } from './shared/database/models/employee.model';
import { AttendanceModel } from './shared/database/models/attendance.model';
import { LeaveRequestModel } from './shared/database/models/leave-request.model';
import { WorkScheduleModel } from './shared/database/models/work-schedule.model';
import { MoveModel } from './shared/database/models/move.model';
import { MOVE_STAGES_SPEC } from './modules/moves/moves.service';
import { PricingRuleModel } from './shared/database/models/pricing-rule.model';
import { ContentEntryModel } from './shared/database/models/content-entry.model';
import {
  CONTENT_DEFAULTS,
  CONTENT_KEYS,
  CONTENT_LOCALES,
} from './modules/content/content.constants';

// Load .env for standalone execution (Next.js pipelines export it in server runtime).
try {
  process.loadEnvFile();
} catch {
  // Missing .env — fall back to the caller's own environment.
}

/**
 * Idempotent seeder: permissions-ready roles + demo accounts per role (spec ch.10).
 * NOTE: unquoted dotenv values are truncated at the first `#` (treated as a
 * comment start), so `Admin#2026!` was hashed as `Admin`. Keep secrets quoted.
 */
async function seed() {
  await connectMongo();

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@moveup.tn';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin#2026!';
  const demoPassword = 'Demo#2026!';

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const demoHash = await bcrypt.hash(demoPassword, 10);

  // Demo hashes are verified-against at runtime as well (documents the fixture).
  if (!(await bcrypt.compare(demoPassword, demoHash))) {
    throw new Error('bcrypt self-check failed');
  }

  // Admin (super-admin operator) — upsert refreshes the hash from env on reseed.
  const adminDoc = await UserModel.findOneAndUpdate(
    { email: adminEmail.toLowerCase() },
    {
      $set: {
        email: adminEmail.toLowerCase(),
        passwordHash: adminHash,
        name: 'Société MoveUp',
        phone: '+216710000000',
        role: 'ADMIN',
        locale: 'en',
        status: 'ACTIVE',
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  if (!adminDoc) throw new Error('Admin upsert failed');
  await seedHr(String(adminDoc._id), adminEmail.toLowerCase());

  // Demo client
  const clientDoc = await UserModel.findOneAndUpdate(
    { email: 'client@moveup.tn' },
    {
      $set: {
        passwordHash: demoHash,
        name: 'Amira Ben Salah',
        phone: '+21655123456',
        role: 'CLIENT',
        locale: 'en',
        status: 'ACTIVE',
      },
      $setOnInsert: { email: 'client@moveup.tn' },
    },
    { upsert: true, returnDocument: 'after' },
  );

  // Omar (Smart layout client)
  const omarDoc = await UserModel.findOneAndUpdate(
    { email: 'omar.client@moveup.tn' },
    {
      $set: {
        passwordHash: demoHash,
        name: 'Omar Test Client',
        phone: '+21622000111',
        role: 'CLIENT',
        locale: 'en',
        status: 'ACTIVE',
        deletedAt: null,
      },
      $setOnInsert: { email: 'omar.client@moveup.tn' },
    },
    { upsert: true, returnDocument: 'after' },
  );

  // Demo mover (approved) + mover profile
  const moverDoc = await UserModel.findOneAndUpdate(
    { email: 'mover@moveup.tn' },
    {
      $set: {
        passwordHash: demoHash,
        name: 'Mehdi Transport',
        phone: '+21698123456',
        role: 'MOVER',
        locale: 'en',
        status: 'ACTIVE',
      },
      $setOnInsert: { email: 'mover@moveup.tn' },
    },
    { upsert: true, returnDocument: 'after' },
  );
  if (!moverDoc) throw new Error('Mover upsert failed');

  const moverId = String(moverDoc._id);
  await MoverProfileModel.findOneAndUpdate(
    { userId: moverId },
    {
      $set: {
        companyName: 'Mehdi Transport',
        bio: 'Van, 14 m³ — grand Tunis.',
        zones: ['TUN'],
        verificationStatus: 'APPROVED',
      },
      $setOnInsert: { userId: moverId },
    },
    { upsert: true },
  );

  // Seed active live move for client@moveup.tn
  if (clientDoc && moverDoc) {
    const moveClientId = String(clientDoc._id);
    const now = new Date();
    await MoveModel.findOneAndUpdate(
      { reference: 'MU-2026-004281' },
      {
        $set: {
          clientId: moveClientId,
          trackingToken: 'demo-tracking-token-2026',
          pickupAddress: '12 Rue du Lac, Les Berges du Lac, Tunis',
          destinationAddress: '8 Avenue Habib Bourguiba, La Marsa',
          distance: 14,
          volume: 3.33,
          estimatedPrice: 185,
          vehicle: { name: 'Moving van', capacity: 14, payload: 1800 },
          mover: {
            userId: moverId,
            name: 'Mehdi Transport',
            phone: '+21698123456',
            companyName: 'Mehdi Transport',
          },
          currentStage: 'IN_TRANSIT',
          items: [
            { id: 'sofa', name: '3-Seater Upholstered Sofa', volume: 1.6, weight: 68, quantity: 1 },
            { id: 'box', name: 'Standard Moving Box', volume: 0.08, weight: 14, quantity: 6 },
            { id: 'table', name: 'Dining Table (Wood)', volume: 1.25, weight: 42, quantity: 1 },
          ],
          stages: [
            { key: 'CONFIRMED', title: 'Booking confirmed', detail: 'Your move request has been confirmed and scheduled.', durationMinutes: 0, estimatedAt: new Date(now.getTime() - 7200000), completedAt: new Date(now.getTime() - 7200000) },
            { key: 'ASSIGNED', title: 'Vehicle assigned', detail: 'A vetted vehicle and mover team have been assigned.', durationMinutes: 12, estimatedAt: new Date(now.getTime() - 6000000), completedAt: new Date(now.getTime() - 6000000) },
            { key: 'EN_ROUTE', title: 'Driver en route', detail: 'Driver is travelling to your pickup location.', durationMinutes: 18, estimatedAt: new Date(now.getTime() - 4200000), completedAt: new Date(now.getTime() - 4200000) },
            { key: 'ARRIVED', title: 'Vehicle arrives', detail: 'Driver arrives at pickup location and prepares loading.', durationMinutes: 5, estimatedAt: new Date(now.getTime() - 3600000), completedAt: new Date(now.getTime() - 3600000) },
            { key: 'LOADING', title: 'Loading starts', detail: 'Furniture and boxes are inventoried and loaded into the vehicle.', durationMinutes: 45, estimatedAt: new Date(now.getTime() - 900000), completedAt: new Date(now.getTime() - 900000) },
            { key: 'IN_TRANSIT', title: 'In transit', detail: 'Your cargo is securely on the road to destination.', durationMinutes: 26, estimatedAt: now, completedAt: null },
            { key: 'DELIVERY', title: 'Delivery', detail: 'Unloading items at the delivery address.', durationMinutes: 35, estimatedAt: new Date(now.getTime() + 1500000), completedAt: null },
            { key: 'COMPLETED', title: 'Move completed', detail: 'Move delivered. Please confirm and review your service.', durationMinutes: null, estimatedAt: new Date(now.getTime() + 3600000), completedAt: null },
          ],
        },
        $setOnInsert: { reference: 'MU-2026-004281' },
      },
      { upsert: true },
    );
    console.log('Seeded live move: MU-2026-004281 (IN_TRANSIT) for client@moveup.tn');
  }

  // Smart Room Layout demo: two booked (not started) moves for omar.client
  if (omarDoc) {
    const demoMoves = [
      {
        reference: 'MU-2026-DEMO01',
        pickupAddress: '12 Rue du Lac, Les Berges du Lac, Tunis',
        destinationAddress: '45 Avenue Habib Bourguiba, Sfax',
        moveDate: '2026-11-20',
        distance: 270,
        volume: 15.18,
        estimatedPrice: 486,
        vehicle: { name: 'Box truck', capacity: 28, payload: 3500 },
        items: [
          { id: 'bed', name: 'Double Bed', volume: 1.8, weight: 55, quantity: 2 },
          { id: 'wardrobe', name: 'Wardrobe (2 doors)', volume: 1.4, weight: 70, quantity: 2 },
          { id: 'sofa', name: '3-Seater Sofa', volume: 1.6, weight: 65, quantity: 1 },
          { id: 'tv-stand', name: 'TV stand', volume: 0.4, weight: 20, quantity: 1 },
          { id: 'table', name: 'Dining Table', volume: 1.25, weight: 35, quantity: 1 },
          { id: 'chair', name: 'Chair / Armchair', volume: 0.18, weight: 8, quantity: 6 },
          { id: 'fridge', name: 'Fridge / Freezer', volume: 1.1, weight: 85, quantity: 1 },
          { id: 'washer', name: 'Washing machine', volume: 0.65, weight: 72, quantity: 1 },
          { id: 'desk', name: 'Office desk', volume: 0.6, weight: 30, quantity: 1 },
          { id: 'scan-7f3a', name: 'Bookshelf (scanned)', volume: 0.5, weight: 25, quantity: 1 },
          { id: 'box', name: 'Moving box', volume: 0.08, weight: 12, quantity: 20 },
        ],
      },
      {
        reference: 'MU-2026-DEMO02',
        pickupAddress: '3 Rue Ibn Khaldoun, Ariana',
        destinationAddress: '18 Rue de Marseille, Tunis',
        moveDate: '2026-12-05',
        distance: 10,
        volume: 5.75,
        estimatedPrice: 80,
        vehicle: { name: 'Compact van', capacity: 6, payload: 1000 },
        items: [
          { id: 'bed', name: 'Double Bed', volume: 1.8, weight: 55, quantity: 1 },
          { id: 'table', name: 'Dining Table', volume: 1.25, weight: 35, quantity: 1 },
          { id: 'chair', name: 'Chair / Armchair', volume: 0.18, weight: 8, quantity: 2 },
          { id: 'fridge', name: 'Fridge / Freezer', volume: 1.1, weight: 85, quantity: 1 },
          { id: 'desk', name: 'Office desk', volume: 0.6, weight: 30, quantity: 1 },
          { id: 'box', name: 'Moving box', volume: 0.08, weight: 12, quantity: 8 },
        ],
      },
    ];
    for (const { reference, moveDate, ...move } of demoMoves) {
      const day = new Date(moveDate);
      await MoveModel.findOneAndUpdate(
        { reference },
        {
          $set: {
            ...move,
            clientId: String(omarDoc._id),
            moveDate: day,
            trackingToken: `demo-tracking-${reference.toLowerCase()}`,
            mover: { userId: moverId, name: 'Mehdi Transport', phone: '+21698123456', companyName: 'Mehdi Transport' },
            currentStage: 'CONFIRMED',
            stages: MOVE_STAGES_SPEC.map((stage) => ({
              key: stage.key,
              title: stage.title,
              detail: stage.detail,
              durationMinutes: stage.minutes,
              estimatedAt: day,
              completedAt: null,
            })),
          },
          $setOnInsert: { reference },
        },
        { upsert: true },
      );
    }
    console.log('Seeded smart-layout moves: MU-2026-DEMO01, MU-2026-DEMO02 for omar.client@moveup.tn');
  }

  // Pricing rule — one active table (registry exclusivity is a service rule).
  await PricingRuleModel.findOneAndUpdate(
    { name: 'MoveUp Standard 2026' },
    {
      $set: {
        status: 'ACTIVE',
        currency: 'TND',
        baseFare: 45,
        perKm: 1.2,
        perM3: 18,
        expressSurcharge: 20,
        minQuote: 60,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveTo: null,
        deletedAt: null,
      },
      $setOnInsert: { name: 'MoveUp Standard 2026' },
    },
    { upsert: true, returnDocument: 'after' },
  );
  // Never keep two ACTIVE rules after a seed.
  await PricingRuleModel.updateMany(
    { name: { $ne: 'MoveUp Standard 2026' }, status: 'ACTIVE' },
    { $set: { status: 'RETIRED' } },
  );

  // Content entries — per-locale registry seeded with the in-code defaults.
  for (const locale of CONTENT_LOCALES) {
    for (const key of Object.keys(CONTENT_KEYS)) {
      await ContentEntryModel.findOneAndUpdate(
        { key, locale },
        {
          $set: { value: CONTENT_DEFAULTS[key] ?? '' },
          $setOnInsert: { key, locale },
        },
        { upsert: true },
      );
    }
  }

  console.log(
    'Seed complete: admin, client, mover + moverProfile, pricing rule, content entries (en/fr/ar).',
  );
}

/**
 * RH / employee-tracking fixtures (ported from the local module's seeder):
 * the admin's own HR record + 5 staff, a week of shifts, today's attendance
 * and two leave requests. Everything is an idempotent upsert.
 */
async function seedHr(organization: string, adminEmail: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const staff = [
    { employeeRef: 'HR001', fullName: 'HR Administrator', email: adminEmail, role: 'hr' },
    {
      employeeRef: 'EMP001',
      fullName: 'Alice Johnson',
      email: 'alice@moveup.tn',
      role: 'employee',
    },
    { employeeRef: 'EMP002', fullName: 'Bob Smith', email: 'bob@moveup.tn', role: 'employee' },
    { employeeRef: 'EMP003', fullName: 'Carol Davis', email: 'carol@moveup.tn', role: 'employee' },
    { employeeRef: 'EMP004', fullName: 'Dave Wilson', email: 'dave@moveup.tn', role: 'employee' },
    { employeeRef: 'EMP005', fullName: 'Eve Brown', email: 'eve@moveup.tn', role: 'employee' },
  ];

  const ids: Record<string, string> = {};
  for (const member of staff) {
    const doc = await EmployeeModel.findOneAndUpdate(
      { employeeRef: member.employeeRef },
      {
        $set: {
          fullName: member.fullName,
          email: member.email,
          role: member.role,
          status: 'active',
          organization,
        },
        $setOnInsert: { employeeRef: member.employeeRef },
      },
      { upsert: true, returnDocument: 'after' },
    );
    if (!doc) throw new Error(`Employee upsert failed: ${member.employeeRef}`);
    ids[member.employeeRef] = String(doc._id);
  }
  console.log('Employees seeded:', staff.map((member) => member.employeeRef).join(', '));

  const employees = Object.values(ids);

  // Shifts for the next 7 days × 5 staff (planned for 3 days, cancelled after).
  for (const employeeId of employees.slice(1)) {
    for (let offset = 0; offset < 7; offset += 1) {
      const dayStart = new Date(today);
      dayStart.setDate(today.getDate() + offset);
      const shiftStart = new Date(dayStart);
      shiftStart.setHours(9, 0, 0, 0);
      const shiftEnd = new Date(dayStart);
      shiftEnd.setHours(17, 0, 0, 0);

      await WorkScheduleModel.findOneAndUpdate(
        { employee: employeeId, workDate: dayStart },
        {
          $set: {
            shiftStart,
            shiftEnd,
            status: offset < 3 ? 'planned' : 'cancelled',
          },
          $setOnInsert: { employee: employeeId, workDate: dayStart },
        },
        { upsert: true },
      );
    }
  }
  console.log('Work schedules seeded for 7 days × 5 employees');

  // Today: first three clock in (the second one late), the last two are absent.
  for (let i = 0; i < 5; i += 1) {
    const employeeId = employees[i + 1];
    if (!employeeId) continue;

    const clockIn = new Date(today);
    clockIn.setHours(9 + i, 30, 0, 0);
    const checkedIn = i < 3;

    await AttendanceModel.findOneAndUpdate(
      { employee: employeeId, workDate: today },
      {
        $set: {
          clockIn: checkedIn ? clockIn : null,
          clockOut: null,
          status: checkedIn ? (i === 1 ? 'late' : 'present') : 'absent',
        },
        $setOnInsert: { employee: employeeId, workDate: today },
      },
      { upsert: true },
    );
  }
  console.log('Attendance records seeded for today');

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  await LeaveRequestModel.findOneAndUpdate(
    { employee: ids.EMP001, type: 'annual', startDate: today },
    {
      $set: {
        endDate: tomorrow,
        daysRequested: 1,
        status: 'pending',
        reason: 'Vacation',
      },
      $setOnInsert: { employee: ids.EMP001, type: 'annual', startDate: today },
    },
    { upsert: true },
  );

  await LeaveRequestModel.findOneAndUpdate(
    { employee: ids.EMP002, type: 'sick', startDate: today },
    {
      $set: {
        endDate: tomorrow,
        daysRequested: 1,
        status: 'approved',
        approvedBy: organization,
        approvedAt: new Date(),
      },
      $setOnInsert: { employee: ids.EMP002, type: 'sick', startDate: today },
    },
    { upsert: true },
  );
  console.log('Leave requests seeded');
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
