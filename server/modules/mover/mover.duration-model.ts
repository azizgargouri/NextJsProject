import type { JobFacts } from './mover.profit';

/**
 * The learned part of the profitability estimate: how long a job really takes.
 *
 *   log(actual hours) = log(basic estimate) + intercept + Σ weight × feature + mover offset
 *
 * A ridge regression learns the shared weights, and each mover's offset is
 * shrunk towards zero until they have finished enough jobs. Pure functions
 * only, so it trains in milliseconds and runs anywhere, offline included.
 */

export const DURATION_FEATURES = [
  'volume',
  'rooms',
  'items',
  'fragile',
  'disassembly',
  'packing',
  'transit',
  'afternoon',
  'house',
  'extraTrips',
] as const;

/** Scaled so every feature sits roughly between 0 and a few units. */
export function featureVector(facts: JobFacts): number[] {
  return [
    Math.log1p(facts.volumeM3 / 10),
    facts.sizeRooms / 5,
    facts.itemCount / 20,
    facts.fragileCount / 5,
    facts.disassemblyCount / 5,
    facts.packing ? 1 : 0,
    facts.transitKm / 100,
    facts.afternoon ? 1 : 0,
    facts.house ? 1 : 0,
    facts.extraTrips,
  ];
}

export interface DurationSample {
  /** Only used to match a sample back to its job. */
  moveId?: string;
  moverId: string;
  features: number[];
  ruleHours: number;
  actualHours: number;
  finishedAt: Date;
}

export interface MoverOffset {
  offset: number;
  jobs: number;
}

export interface DurationParams {
  intercept: number;
  weights: number[];
  moverOffsets: Record<string, MoverOffset>;
  /** Spread of the remaining error, on the log scale. */
  sigma: number;
}

/** Stops a few unusual jobs from swinging the weights. */
const RIDGE_PENALTY = 1;
/** A mover's offset counts for half once they have this many jobs. */
const MOVER_SHRINK_JOBS = 10;
const BACKFIT_ROUNDS = 5;
/** Spread used before any model exists: about ±40% on a typical job. */
export const DEFAULT_SIGMA = 0.35;
/** The worst case is the 90th percentile. */
const Z_90 = 1.2816;

function target(sample: DurationSample): number {
  return Math.log(sample.actualHours) - Math.log(sample.ruleHours);
}

/** Gaussian elimination with partial pivoting; the systems here are about 11 × 11. */
export function solveLinear(matrix: number[][], vector: number[]): number[] {
  const size = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index] ?? 0]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row]![column]!) > Math.abs(rows[pivot]![column]!)) pivot = row;
    }
    [rows[column], rows[pivot]] = [rows[pivot]!, rows[column]!];
    const lead = rows[column]![column]!;
    if (Math.abs(lead) < 1e-12) throw new Error('The training data does not determine the model');
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row]![column]! / lead;
      for (let cell = column; cell <= size; cell += 1) {
        rows[row]![cell]! -= factor * rows[column]![cell]!;
      }
    }
  }
  return rows.map((row, index) => row[size]! / row[index]!);
}

function fitFixedEffects(samples: DurationSample[], targets: number[]): number[] {
  const width = (samples[0]?.features.length ?? 0) + 1;
  const normal = Array.from({ length: width }, () => new Array<number>(width).fill(0));
  const right = new Array<number>(width).fill(0);
  samples.forEach((sample, index) => {
    const row = [1, ...sample.features];
    for (let i = 0; i < width; i += 1) {
      right[i]! += row[i]! * targets[index]!;
      for (let j = 0; j < width; j += 1) normal[i]![j]! += row[i]! * row[j]!;
    }
  });
  // The intercept is not penalised.
  for (let i = 1; i < width; i += 1) normal[i]![i]! += RIDGE_PENALTY;
  return solveLinear(normal, right);
}

function linear(params: Pick<DurationParams, 'intercept' | 'weights'>, features: number[]) {
  return features.reduce(
    (total, value, index) => total + value * (params.weights[index] ?? 0),
    params.intercept,
  );
}

export function fitDurationModel(samples: DurationSample[]): DurationParams {
  if (samples.length === 0) throw new Error('No finished jobs to learn from');
  const targets = samples.map(target);
  let offsets: Record<string, MoverOffset> = {};
  let coefficients: number[] = [];

  for (let round = 0; round < BACKFIT_ROUNDS; round += 1) {
    coefficients = fitFixedEffects(
      samples,
      targets.map((value, index) => value - (offsets[samples[index]!.moverId]?.offset ?? 0)),
    );
    const fixed = { intercept: coefficients[0]!, weights: coefficients.slice(1) };
    const sums = new Map<string, { total: number; jobs: number }>();
    samples.forEach((sample, index) => {
      const entry = sums.get(sample.moverId) ?? { total: 0, jobs: 0 };
      entry.total += targets[index]! - linear(fixed, sample.features);
      entry.jobs += 1;
      sums.set(sample.moverId, entry);
    });
    offsets = Object.fromEntries(
      [...sums].map(([moverId, { total, jobs }]) => [
        moverId,
        { offset: total / (jobs + MOVER_SHRINK_JOBS), jobs },
      ]),
    );
  }

  const params = {
    intercept: coefficients[0]!,
    weights: coefficients.slice(1),
    moverOffsets: offsets,
  };
  const squared = samples.reduce((total, sample, index) => {
    const error =
      targets[index]! - logCorrection({ ...params, sigma: 0 }, sample.features, sample.moverId);
    return total + error * error;
  }, 0);
  const freedom = Math.max(1, samples.length - coefficients.length);
  return { ...params, sigma: Math.max(0.05, Math.sqrt(squared / freedom)) };
}

export function logCorrection(params: DurationParams, features: number[], moverId: string): number {
  return linear(params, features) + (params.moverOffsets[moverId]?.offset ?? 0);
}

/** Likely and worst-case working hours. Without a model, the basic estimate is used. */
export function predictWorkHours(
  params: DurationParams | null,
  ruleHours: number,
  features: number[],
  moverId: string,
): { likely: number; worst: number } {
  const base = Math.max(ruleHours, 0.25);
  const correction = params ? logCorrection(params, features, moverId) : 0;
  const sigma = params?.sigma ?? DEFAULT_SIGMA;
  return {
    likely: base * Math.exp(correction),
    worst: base * Math.exp(correction + Z_90 * sigma),
  };
}

export function meanAbsoluteError(
  samples: DurationSample[],
  predict: (sample: DurationSample) => number,
): number {
  if (samples.length === 0) return Number.NaN;
  return (
    samples.reduce((total, sample) => total + Math.abs(predict(sample) - sample.actualHours), 0) /
    samples.length
  );
}

/**
 * The gate: a new version must beat the basic estimate, and the live model on
 * jobs that model had not seen. A tie with the live model is enough, since the
 * new one has learned from more jobs.
 */
export function shouldPromote(result: {
  modelMae: number;
  baselineMae: number;
  previous: { liveMae: number; candidateMae: number } | null;
}): boolean {
  if (!(result.modelMae < result.baselineMae)) return false;
  return result.previous === null || result.previous.candidateMae <= result.previous.liveMae;
}

/** Oldest jobs train, the most recent ones test: the model is judged on jobs it has not seen. */
export function splitByTime(samples: DurationSample[], holdoutShare = 0.2) {
  const sorted = [...samples].sort((a, b) => a.finishedAt.getTime() - b.finishedAt.getTime());
  const holdoutSize = Math.max(1, Math.round(sorted.length * holdoutShare));
  return { train: sorted.slice(0, -holdoutSize), holdout: sorted.slice(-holdoutSize) };
}
