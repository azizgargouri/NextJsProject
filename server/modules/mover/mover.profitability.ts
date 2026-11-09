import { env } from '../../config/env';
import type { MoveRequestDoc } from '../../shared/database/models';
import type { ProfitabilityDto } from '../../../types/mover';
import { DEFAULT_COMMISSION_RATE } from './mover.constants';
import { durationRepository } from './mover.duration-repository';
import {
  featureVector,
  logCorrection,
  predictWorkHours,
  type DurationParams,
} from './mover.duration-model';
import { jobFacts, moverCosts, planTrip, priceJob, ruleWorkHours } from './mover.profit';
import { moverRepository as repo } from './mover.repository';

/**
 * Profitability of an offer for one mover: the basic rules, corrected by the
 * live duration model when there is one. The model and the price history are
 * cached in memory and re-read every few minutes, so a newly trained version
 * is picked up without a restart.
 */
const CACHE_MS = 5 * 60 * 1000;
const PRICE_HISTORY = 500;
const SIMILAR_JOBS = 8;
const MIN_SIMILAR_JOBS = 3;
/** Jobs further than this (in the scaled units below) are not "similar". */
const MAX_SIMILARITY_DISTANCE = 1;
/** A mover's own adjustment is shown, and trusted, from these job counts. */
const MOVER_FACTOR_JOBS = 5;
const GOOD_CONFIDENCE_JOBS = 15;

interface LiveModel extends DurationParams {
  version: number;
  sampleSize: number;
}

interface PricedJob {
  volumeM3: number;
  transitKm: number;
  sizeRooms: number;
  price: number;
}

let cache: { loadedAt: number; model: LiveModel | null; priced: PricedJob[] } | null = null;

/** Drops the cached model, so the next estimate reads the latest live version. */
export function forgetDurationModelCache(): void {
  cache = null;
}

async function shared(now: number) {
  if (cache && now - cache.loadedAt < CACHE_MS) return cache;
  const [live, priced] = await Promise.all([
    durationRepository.liveModel(),
    durationRepository.pricedMoves(PRICE_HISTORY),
  ]);
  cache = {
    loadedAt: now,
    model: live
      ? {
          version: live.version,
          sampleSize: live.sampleSize,
          intercept: live.intercept,
          weights: live.weights,
          sigma: live.sigma,
          moverOffsets: Object.fromEntries(
            live.moverOffsets.map(({ moverId, offset, jobs }) => [moverId, { offset, jobs }]),
          ),
        }
      : null,
    priced: priced.map((move) => ({
      volumeM3: move.volumeM3,
      transitKm: planTrip(move, move.pickup.zone, null).transitKm,
      sizeRooms: move.sizeRooms,
      price: move.finalPrice ?? 0,
    })),
  };
  return cache;
}

function percentile(sorted: number[], share: number): number {
  const position = (sorted.length - 1) * share;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (position - low);
}

const roundTo5 = (value: number) => Math.round(value / 5) * 5;

/** What the nearest finished jobs were paid, middle half of them. */
export function similarPriceRange(
  job: { volumeM3: number; transitKm: number; sizeRooms: number },
  history: PricedJob[],
): { low: number; high: number } | null {
  const nearest = history
    .map((past) => ({
      price: past.price,
      distance: Math.hypot(
        (past.volumeM3 - job.volumeM3) / 10,
        (past.transitKm - job.transitKm) / 100,
        (past.sizeRooms - job.sizeRooms) / 5,
      ),
    }))
    .filter((past) => past.distance <= MAX_SIMILARITY_DISTANCE && past.price > 0)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, SIMILAR_JOBS)
    .map((past) => past.price)
    .sort((a, b) => a - b);
  if (nearest.length < MIN_SIMILAR_JOBS) return null;
  return { low: roundTo5(percentile(nearest, 0.25)), high: roundTo5(percentile(nearest, 0.75)) };
}

export interface OfferEstimate {
  profitability: ProfitabilityDto;
  /** What gets recorded on the offer when the mover takes the job. */
  estimate: {
    workHoursLikely: number;
    workHoursWorst: number;
    ruleHours: number;
    modelVersion: number | null;
  };
}

/** Loads everything about the mover once, then estimates any number of moves. */
export async function profitEstimator(
  moverId: string,
  now: Date = new Date(),
): Promise<(move: MoveRequestDoc, price: number | null) => OfferEstimate> {
  const [profile, vehicles, rule, { model: liveModel, priced }] = await Promise.all([
    repo.findProfile(moverId),
    repo.listVehicles(moverId),
    repo.activePricingRule(),
    shared(now.getTime()),
  ]);
  const model = env().PROFIT_MODEL === 'off' ? null : liveModel;
  const costs = moverCosts(profile);
  const capacity = vehicles.length
    ? Math.max(...vehicles.map((vehicle) => vehicle.capacityM3))
    : null;
  const ownOffset = model?.moverOffsets[moverId];

  return (move, price) => {
    const trip = planTrip(move, profile?.zones[0] ?? move.pickup.zone, capacity);
    const facts = jobFacts(move, trip, costs.helpers);
    const basic = ruleWorkHours(facts);
    const features = featureVector(facts);
    const work = predictWorkHours(model, basic.hours, features, moverId);

    const profitability = priceJob({
      price,
      currency: rule?.currency ?? 'TND',
      commissionRate: rule?.commissionRate ?? DEFAULT_COMMISSION_RATE,
      costs,
      costsAreDefaults: !profile?.costs,
      trip,
      rule: basic,
      work: {
        ...work,
        modelFactor: model
          ? Math.exp(logCorrection({ ...model, moverOffsets: {} }, features, moverId))
          : null,
        moverFactor:
          ownOffset && ownOffset.jobs >= MOVER_FACTOR_JOBS ? Math.exp(ownOffset.offset) : null,
        confidence: model && (ownOffset?.jobs ?? 0) >= GOOD_CONFIDENCE_JOBS ? 'GOOD' : 'ROUGH',
        basedOnJobs: model?.sampleSize ?? 0,
        modelVersion: model?.version ?? null,
      },
      similarRange: similarPriceRange(
        { volumeM3: move.volumeM3, transitKm: trip.transitKm, sizeRooms: move.sizeRooms },
        priced,
      ),
      hasVehicle: capacity !== null,
    });

    return {
      profitability,
      estimate: {
        workHoursLikely: work.likely,
        workHoursWorst: work.worst,
        ruleHours: basic.hours,
        modelVersion: model?.version ?? null,
      },
    };
  };
}
