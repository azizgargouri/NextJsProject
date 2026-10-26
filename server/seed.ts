import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectMongo } from './shared/database/mongoose';
import { UserModel } from './shared/database/models/user.model';
import { MoverProfileModel } from './shared/database/models/mover-profile.model';
import { EmployeeModel } from './shared/database/models/employee.model';
import { AttendanceModel } from './shared/database/models/attendance.model';
import { LeaveRequestModel } from './shared/database/models/leave-request.model';
import { WorkScheduleModel } from './shared/database/models/work-schedule.model';

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
  await UserModel.findOneAndUpdate(
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
    { upsert: true },
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

  console.log('Seed complete: admin, client, mover + moverProfile (demo accounts).');
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
