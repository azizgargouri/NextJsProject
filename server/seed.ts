import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectMongo } from './shared/database/mongoose';
import { UserModel } from './shared/database/models/user.model';
import { MoverProfileModel } from './shared/database/models/mover-profile.model';

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
  await UserModel.findOneAndUpdate(
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
    { upsert: true },
  );

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

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
