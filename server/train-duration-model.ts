import mongoose from 'mongoose';
import { connectMongo } from './shared/database/mongoose';
import { recordedAccuracy, trainDurationModel } from './modules/mover/mover.duration-training';

try {
  process.loadEnvFile();
} catch {
  // Missing .env: fall back to the caller's own environment.
}

/**
 * Trains the job-duration model now: `npm run ai:train`. The app also retrains
 * on its own as jobs are delivered, so this is for a first run or a check.
 */
const hours = (value: number | null) => (value === null ? 'n/a' : `${value.toFixed(2)} h`);

async function main() {
  await connectMongo();
  const outcome = await trainDurationModel();
  if (outcome.status === 'SKIPPED') {
    console.log(`Not trained: ${outcome.reason}`);
  } else {
    console.log(
      `Version ${outcome.version} ${outcome.status === 'LIVE' ? 'is now live' : 'was rejected'}, ` +
        `trained on ${outcome.sampleSize} jobs.`,
    );
    console.log(`  Error on recent jobs:   model ${hours(outcome.modelMae)}`);
    console.log(`                          basic estimate ${hours(outcome.baselineMae)}`);
    console.log(`                          previous model ${hours(outcome.previousMae)}`);
  }
  const accuracy = await recordedAccuracy();
  console.log(
    `Estimates shown to movers: ${accuracy.jobs} finished jobs, ` +
      `average error ${hours(accuracy.meanErrorHours)}.`,
  );
}

main()
  .catch((error) => {
    console.error('Training failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
