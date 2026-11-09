import { durationRepository as repo } from './mover.duration-repository';
import {
  DURATION_FEATURES,
  featureVector,
  fitDurationModel,
  meanAbsoluteError,
  predictWorkHours,
  shouldPromote,
  splitByTime,
  type DurationParams,
  type DurationSample,
} from './mover.duration-model';
import { jobFacts, moverCosts, planTrip, ruleWorkHours } from './mover.profit';
import { forgetDurationModelCache } from './mover.profitability';

/**
 * Trains the job-duration model from finished jobs. A new version goes live
 * only if it beats the basic estimate, and the previous live model on jobs
 * that model had not seen; otherwise it is kept as REJECTED for the record.
 */
export const MIN_TRAINING_JOBS = 30;
export const RETRAIN_EVERY_JOBS = 10;
const TRAINING_WINDOW = 2000;
const LOCK_MS = 5 * 60 * 1000;
/** Shorter or longer than this is almost always a forgotten tap, not a real job. */
const MIN_WORK_HOURS = 0.25;
const MAX_WORK_HOURS = 16;
const MIN_UNSEEN_FOR_COMPARISON = 5;

/** Finished jobs with clean working times, from start of loading to delivery. */
export async function collectDurationSamples(): Promise<DurationSample[]> {
  const moves = await repo.finishedMoves(TRAINING_WINDOW);
  const moverIds = [...new Set(moves.map((move) => move.assignedMoverId ?? ''))];
  const [events, profiles, vehicles] = await Promise.all([
    repo.workEvents(moves.map((move) => String(move._id))),
    repo.profiles(moverIds),
    repo.vehicles(moverIds),
  ]);

  const times = new Map<string, { start?: Date; end?: Date }>();
  for (const event of events) {
    const entry = times.get(event.moveId) ?? {};
    if (event.toStatus === 'IN_PROGRESS' && !entry.start) entry.start = event.createdAt;
    if (event.toStatus === 'DELIVERED' && !entry.end) entry.end = event.createdAt;
    times.set(event.moveId, entry);
  }
  const profileOf = new Map(profiles.map((profile) => [profile.userId, profile]));
  const capacityOf = new Map<string, number>();
  for (const vehicle of vehicles) {
    capacityOf.set(
      vehicle.moverId,
      Math.max(capacityOf.get(vehicle.moverId) ?? 0, vehicle.capacityM3),
    );
  }

  return moves.flatMap((move) => {
    const moverId = move.assignedMoverId;
    const { start, end } = times.get(String(move._id)) ?? {};
    if (!moverId || !start || !end) return [];
    const actualHours = (end.getTime() - start.getTime()) / 3_600_000;
    if (actualHours < MIN_WORK_HOURS || actualHours > MAX_WORK_HOURS) return [];

    const trip = planTrip(move, move.pickup.zone, capacityOf.get(moverId) ?? null);
    const facts = jobFacts(move, trip, moverCosts(profileOf.get(moverId) ?? null).helpers);
    return [
      {
        moveId: String(move._id),
        moverId,
        features: featureVector(facts),
        ruleHours: Math.max(ruleWorkHours(facts).hours, MIN_WORK_HOURS),
        actualHours,
        finishedAt: end,
      },
    ];
  });
}

export type TrainingOutcome =
  | { status: 'SKIPPED'; reason: string }
  | {
      status: 'LIVE' | 'REJECTED';
      version: number;
      sampleSize: number;
      modelMae: number;
      baselineMae: number;
      previousMae: number | null;
    };

const predictor = (params: DurationParams) => (sample: DurationSample) =>
  predictWorkHours(params, sample.ruleHours, sample.features, sample.moverId).likely;

export async function trainDurationModel(now: Date = new Date()): Promise<TrainingOutcome> {
  if (!(await repo.claimTrainingLock(now, LOCK_MS))) {
    return { status: 'SKIPPED', reason: 'Another server is training right now.' };
  }
  let jobsAtRun: number | null = null;
  try {
    jobsAtRun = await repo.countFinishedMoves();
    const samples = await collectDurationSamples();
    if (samples.length < MIN_TRAINING_JOBS) {
      return {
        status: 'SKIPPED',
        reason: `Needs ${MIN_TRAINING_JOBS} finished jobs with clean times, has ${samples.length}.`,
      };
    }

    const { train, holdout } = splitByTime(samples);
    const candidate = fitDurationModel(train);
    const modelMae = meanAbsoluteError(holdout, predictor(candidate));
    const baselineMae = meanAbsoluteError(holdout, (sample) => sample.ruleHours);

    // The live model is only judged on jobs that finished after it was trained.
    let previousMae: number | null = null;
    let previous: { liveMae: number; candidateMae: number } | null = null;
    const live = await repo.liveModel();
    if (live) {
      const unseen = holdout.filter((sample) => sample.finishedAt > live.trainedAt);
      if (unseen.length >= MIN_UNSEEN_FOR_COMPARISON) {
        const liveParams: DurationParams = {
          intercept: live.intercept,
          weights: live.weights,
          sigma: live.sigma,
          moverOffsets: Object.fromEntries(
            live.moverOffsets.map(({ moverId, offset, jobs }) => [moverId, { offset, jobs }]),
          ),
        };
        previousMae = meanAbsoluteError(unseen, predictor(liveParams));
        previous = {
          liveMae: previousMae,
          candidateMae: meanAbsoluteError(unseen, predictor(candidate)),
        };
      }
    }

    const promote = shouldPromote({ modelMae, baselineMae, previous });
    // A model that passed is refitted on every job, the most recent ones included.
    const params = promote ? fitDurationModel(samples) : candidate;
    const version = (await repo.latestVersion()) + 1;
    await repo.saveModel({
      version,
      status: promote ? 'LIVE' : 'REJECTED',
      features: [...DURATION_FEATURES],
      intercept: params.intercept,
      weights: params.weights,
      moverOffsets: Object.entries(params.moverOffsets).map(([moverId, value]) => ({
        moverId,
        ...value,
      })),
      sigma: params.sigma,
      sampleSize: samples.length,
      holdoutSize: holdout.length,
      modelMae,
      baselineMae,
      previousMae,
      trainedAt: now,
    });
    if (promote) forgetDurationModelCache();
    return {
      status: promote ? 'LIVE' : 'REJECTED',
      version,
      sampleSize: samples.length,
      modelMae,
      baselineMae,
      previousMae,
    };
  } finally {
    await repo.releaseTrainingLock(now, jobsAtRun);
  }
}

/** Called when a job is delivered: retrains once enough new jobs have finished. */
export async function maybeRetrainDurationModel(now: Date = new Date()): Promise<void> {
  const [finished, state] = await Promise.all([repo.countFinishedMoves(), repo.trainingState()]);
  if (finished < MIN_TRAINING_JOBS) return;
  if (finished - (state?.jobsAtLastRun ?? 0) < RETRAIN_EVERY_JOBS) return;
  await trainDurationModel(now);
}

/** How far the estimates movers were shown landed from the real working time. */
export async function recordedAccuracy(): Promise<{ jobs: number; meanErrorHours: number | null }> {
  const samples = await collectDurationSamples();
  const actualByMove = new Map(samples.map((sample) => [sample.moveId ?? '', sample.actualHours]));
  const estimates = await repo.recordedEstimates([...actualByMove.keys()]);
  const errors = estimates.flatMap((entry) => {
    const actual = actualByMove.get(entry.moveId);
    return actual === undefined ? [] : [Math.abs(entry.estimate.workHoursLikely - actual)];
  });
  return {
    jobs: errors.length,
    meanErrorHours: errors.length
      ? errors.reduce((total, error) => total + error, 0) / errors.length
      : null,
  };
}
