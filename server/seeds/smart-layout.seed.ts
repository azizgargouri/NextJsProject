import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectMongo } from '../shared/database/mongoose';
import { UserModel } from '../shared/database/models/user.model';

try {
  process.loadEnvFile();
} catch {
  // Missing .env — fall back to the caller's own environment.
}

/**
 * Smart Room Layout (Omar) — idempotent test fixtures.
 * Run after the shared seed: `yarn db:seed && yarn tsx server/seeds/smart-layout.seed.ts`.
 */
const SMART_LAYOUT_CLIENT = {
  email: 'omar.client@moveup.tn',
  password: 'Demo#2026!',
  name: 'Omar Test Client',
  phone: '+21622000111',
} as const;

async function seed() {
  await connectMongo();

  await UserModel.findOneAndUpdate(
    { email: SMART_LAYOUT_CLIENT.email },
    {
      $set: {
        passwordHash: await bcrypt.hash(SMART_LAYOUT_CLIENT.password, 10),
        name: SMART_LAYOUT_CLIENT.name,
        phone: SMART_LAYOUT_CLIENT.phone,
        role: 'CLIENT',
        locale: 'en',
        status: 'ACTIVE',
        deletedAt: null,
      },
      $setOnInsert: { email: SMART_LAYOUT_CLIENT.email },
    },
    { upsert: true },
  );

  console.log(`Smart layout seed complete: ${SMART_LAYOUT_CLIENT.email} (CLIENT).`);
}

seed()
  .catch((error) => {
    console.error('Smart layout seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
