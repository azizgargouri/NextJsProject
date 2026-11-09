import mongoose from 'mongoose';
import {
  PLAYGROUND_MODULES,
  playgroundStatus,
  resetPlayground,
  seedPlayground,
  type PlaygroundModule,
} from '../modules/playground';

try {
  process.loadEnvFile();
} catch {
  // Missing .env — fall back to the caller's own environment.
}

/**
 * Seeder playground — fake data for every module, for testing.
 *
 *   yarn db:playground                       seed every module (idempotent)
 *   yarn db:playground --only=bookings,quality
 *   yarn db:playground --status              counts only
 *   yarn db:playground --reset               remove the playground data only
 *
 * Run `yarn db:seed` once before: it creates the core demo accounts.
 */
async function main() {
  const args = process.argv.slice(2);
  const only = args.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
  const modules = only
    ? (only.split(',').map((name) => name.trim()) as PlaygroundModule[])
    : [...PLAYGROUND_MODULES];
  const unknown = modules.filter((name) => !PLAYGROUND_MODULES.includes(name));
  if (unknown.length) {
    throw new Error(
      `Unknown module(s): ${unknown.join(', ')}. Use: ${PLAYGROUND_MODULES.join(', ')}`,
    );
  }

  const status = args.includes('--reset')
    ? await resetPlayground()
    : args.includes('--status')
      ? await playgroundStatus()
      : await seedPlayground(modules);

  for (const [name, counts] of Object.entries(status)) {
    const line = Object.entries(counts)
      .map(([name, count]) => `${name} ${count}`)
      .join(' · ');
    console.log(`  ${name.padEnd(11)} ${line}`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
