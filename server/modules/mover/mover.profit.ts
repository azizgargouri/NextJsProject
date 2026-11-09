import type { MoveRequestDoc, MoverProfileDoc } from '../../shared/database/models';
import type { MoverCostsDto, ProfitabilityDto, ProfitVerdict } from '../../../types/mover';
import { DEFAULT_MOVER_COSTS } from './mover.constants';
import { roundMoney } from './mover.rules';

/**
 * Profitability rules: trip distances, job facts, the basic duration estimate
 * and the money. Pure functions only; the learned correction lives in
 * mover.duration-model.ts.
 */

/** Road distances between zone centres, in km. Close enough for costing a trip. */
const ZONE_DISTANCES_KM: Record<string, number> = {
  'BIZ-KAI': 215,
  'BIZ-NAB': 125,
  'BIZ-SFA': 330,
  'BIZ-SOU': 200,
  'BIZ-TUN': 65,
  'KAI-NAB': 140,
  'KAI-SFA': 130,
  'KAI-SOU': 60,
  'KAI-TUN': 155,
  'NAB-SFA': 230,
  'NAB-SOU': 100,
  'NAB-TUN': 65,
  'SFA-SOU': 130,
  'SFA-TUN': 270,
  'SOU-TUN': 140,
};
const SAME_ZONE_KM = 15;
/** Used when a zone pair is missing from the table; the estimate says so. */
const UNKNOWN_ZONE_KM = 60;
const CITY_KMH = 25;
const ROAD_KMH = 65;
const SUGGESTED_QUOTE_STEP = 5;
/** Below this share of the target, a job is LOW rather than OK. */
const OK_SHARE_OF_TARGET = 0.6;

export function zoneDistanceKm(from: string, to: string): number | null {
  if (from === to) return SAME_ZONE_KM;
  return ZONE_DISTANCES_KM[[from, to].sort().join('-')] ?? null;
}

export function driveHours(km: number): number {
  return km / (km > 40 ? ROAD_KMH : CITY_KMH);
}

export function moverCosts(profile: Pick<MoverProfileDoc, 'costs'> | null): MoverCostsDto {
  const costs = profile?.costs;
  if (!costs) return { ...DEFAULT_MOVER_COSTS };
  return {
    fuelLitresPer100Km: costs.fuelLitresPer100Km,
    fuelPricePerLitre: costs.fuelPricePerLitre,
    helpers: costs.helpers,
    helperHourlyRate: costs.helperHourlyRate,
    costPerKm: costs.costPerKm,
    targetHourlyNet: costs.targetHourlyNet,
  };
}

export interface Trip {
  toPickupKm: number;
  transitKm: number;
  backKm: number;
  /** Extra round trips between pickup and destination when the load does not fit. */
  extraTrips: number;
  totalKm: number;
  unknownDistance: boolean;
}

/** From the mover's base to the pickup, to the destination, and back to base. */
export function planTrip(
  move: Pick<MoveRequestDoc, 'pickup' | 'dropoff' | 'volumeM3'>,
  baseZone: string,
  capacityM3: number | null,
): Trip {
  const legs = [
    zoneDistanceKm(baseZone, move.pickup.zone),
    zoneDistanceKm(move.pickup.zone, move.dropoff.zone),
    zoneDistanceKm(move.dropoff.zone, baseZone),
  ];
  const [toPickupKm, transitKm, backKm] = legs.map((km) => km ?? UNKNOWN_ZONE_KM) as [
    number,
    number,
    number,
  ];
  const trips = capacityM3 && capacityM3 > 0 ? Math.ceil(move.volumeM3 / capacityM3) : 1;
  const extraTrips = Math.max(0, trips - 1);
  return {
    toPickupKm,
    transitKm,
    backKm,
    extraTrips,
    totalKm: toPickupKm + transitKm + backKm + extraTrips * 2 * transitKm,
    unknownDistance: legs.some((km) => km === null),
  };
}

/** What the duration estimate looks at. Floors and elevators are left out on purpose. */
export interface JobFacts {
  volumeM3: number;
  sizeRooms: number;
  /** Pieces to carry, not counting boxes (the volume already covers those). */
  itemCount: number;
  fragileCount: number;
  disassemblyCount: number;
  packing: boolean;
  transitKm: number;
  afternoon: boolean;
  house: boolean;
  extraTrips: number;
  /** Driver plus helpers. */
  crew: number;
}

export function jobFacts(
  move: Pick<
    MoveRequestDoc,
    'volumeM3' | 'sizeRooms' | 'items' | 'extraServices' | 'timeSlot' | 'housingType'
  >,
  trip: Pick<Trip, 'transitKm' | 'extraTrips'>,
  helpers: number,
): JobFacts {
  const count = (keep: (item: MoveRequestDoc['items'][number]) => boolean) =>
    move.items.filter(keep).reduce((total, item) => total + Math.max(0, item.quantity), 0);
  return {
    volumeM3: Math.max(0, move.volumeM3),
    sizeRooms: Math.max(0, move.sizeRooms),
    itemCount: count((item) => !/box/i.test(item.category)),
    fragileCount: count((item) => item.isFragile),
    disassemblyCount: count((item) => item.needsDisassembly),
    packing: move.extraServices.some((service) => /pack/i.test(service)),
    transitKm: trip.transitKm,
    afternoon: move.timeSlot === 'AFTERNOON',
    house: /house|villa/i.test(move.housingType),
    extraTrips: trip.extraTrips,
    crew: 1 + Math.max(0, helpers),
  };
}

export interface DurationPart {
  label: string;
  hours: number;
}

/**
 * Basic estimate of working time, from the start of loading to delivery. It is
 * what the app uses before the model has learned anything, and the model learns
 * a correction on top of it.
 */
export function ruleWorkHours(facts: JobFacts): { hours: number; parts: DurationPart[] } {
  // A crew of two is the reference; more hands help, with diminishing returns.
  const labour = Math.sqrt(2 / Math.max(1, facts.crew));
  const transit = driveHours(facts.transitKm);
  const parts: DurationPart[] = [
    { label: 'Getting set up at both ends', hours: 0.5 },
    { label: `${facts.volumeM3} m³ to load and unload`, hours: facts.volumeM3 * 0.12 * labour },
    { label: 'Driving to the destination', hours: transit },
  ];
  if (facts.packing) {
    parts.push({ label: 'Packing service', hours: facts.volumeM3 * 0.06 * labour });
  }
  if (facts.disassemblyCount > 0) {
    parts.push({
      label: `${facts.disassemblyCount} ${plural(facts.disassemblyCount, 'item')} to take apart and rebuild`,
      hours: facts.disassemblyCount * 0.5,
    });
  }
  if (facts.fragileCount > 0) {
    parts.push({
      label: `${facts.fragileCount} fragile ${plural(facts.fragileCount, 'item')}`,
      hours: facts.fragileCount * 0.1,
    });
  }
  if (facts.extraTrips > 0) {
    parts.push({
      label: `${facts.extraTrips} extra ${plural(facts.extraTrips, 'trip')}, the load does not fit in one`,
      hours: facts.extraTrips * 2 * transit,
    });
  }
  return { hours: parts.reduce((total, part) => total + part.hours, 0), parts };
}

export interface WorkEstimate {
  likely: number;
  worst: number;
  /** Learned adjustment for the whole job: 1.2 means 20% longer than the basic estimate. */
  modelFactor: number | null;
  /** This mover's own adjustment, once they have finished enough jobs. */
  moverFactor: number | null;
  confidence: 'ROUGH' | 'GOOD';
  basedOnJobs: number;
  modelVersion: number | null;
}

export interface PriceContext {
  price: number | null;
  currency: string;
  commissionRate: number;
  costs: MoverCostsDto;
  costsAreDefaults: boolean;
  trip: Trip;
  rule: { hours: number; parts: DurationPart[] };
  work: WorkEstimate;
  similarRange: { low: number; high: number } | null;
  hasVehicle: boolean;
}

export function formatHours(hours: number): string {
  const minutes = Math.max(0, Math.round(hours * 60));
  const whole = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (whole === 0) return `${rest} min`;
  return rest === 0 ? `${whole}h` : `${whole}h ${String(rest).padStart(2, '0')}m`;
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}

function percent(factor: number): string {
  return `${Math.round(Math.abs(factor - 1) * 100)}%`;
}

export function verdictFor(netPerHour: number, target: number): ProfitVerdict {
  if (netPerHour >= target) return 'GOOD';
  if (netPerHour > 0 && netPerHour >= target * OK_SHARE_OF_TARGET) return 'OK';
  return 'LOW';
}

/** Turns the trip, the duration estimate and the mover's costs into money. */
export function priceJob(context: PriceContext): ProfitabilityDto {
  const { costs, trip, work, commissionRate } = context;
  const driving = driveHours(trip.toPickupKm) + driveHours(trip.backKm);
  // Rounded once, so every figure shown agrees with the others.
  const hoursLikely = roundHours(driving + work.likely);
  const hoursWorst = roundHours(driving + work.worst);

  const fuel = roundMoney(
    (trip.totalKm * costs.fuelLitresPer100Km * costs.fuelPricePerLitre) / 100,
  );
  const wear = roundMoney(trip.totalKm * costs.costPerKm);
  const helpersFor = (hours: number) => roundMoney(costs.helpers * costs.helperHourlyRate * hours);
  const costsFor = (hours: number) => fuel + wear + helpersFor(hours);

  const netAt = (price: number, hours: number) =>
    roundMoney(price * (1 - commissionRate) - costsFor(hours));
  const perHour = (net: number) => roundMoney(net / Math.max(hoursLikely, 0.25));

  // Enough to cover the worst case and still earn the target, before commission.
  const suggestedAmount =
    context.price === null
      ? Math.ceil(
          (costsFor(hoursWorst) + costs.targetHourlyNet * hoursWorst) /
            Math.max(0.05, 1 - commissionRate) /
            SUGGESTED_QUOTE_STEP,
        ) * SUGGESTED_QUOTE_STEP
      : null;

  // The money is laid out against the real price, or the suggested one while a quote is needed.
  const shownPrice = context.price ?? suggestedAmount ?? 0;
  const km = Math.round(trip.totalKm);
  const breakdown: ProfitabilityDto['breakdown'] = [
    {
      label: context.price === null ? 'Suggested price' : 'Price',
      amount: roundMoney(shownPrice),
      kind: 'PRICE',
    },
    {
      label: `Commission (${Math.round(commissionRate * 100)}%)`,
      amount: -roundMoney(shownPrice * commissionRate),
      kind: 'COMMISSION',
    },
    { label: `Fuel (${km} km)`, amount: -fuel, kind: 'FUEL' },
  ];
  if (costs.helpers > 0) {
    breakdown.push({
      label: `Helpers (${costs.helpers} × ${formatHours(hoursLikely)})`,
      amount: -helpersFor(hoursLikely),
      kind: 'HELPERS',
    });
  }
  breakdown.push({ label: `Vehicle wear (${km} km)`, amount: -wear, kind: 'WEAR' });

  let net: number | null = null;
  let netWorstCase: number | null = null;
  let netPerHour: number | null = null;
  let verdict: ProfitVerdict | null = null;
  if (context.price !== null) {
    net = netAt(context.price, hoursLikely);
    netWorstCase = netAt(context.price, hoursWorst);
    netPerHour = perHour(net);
    verdict = verdictFor(netPerHour, costs.targetHourlyNet);
  }

  const suggestedNet = suggestedAmount === null ? null : netAt(suggestedAmount, hoursLikely);
  const suggestedQuote =
    suggestedAmount === null || suggestedNet === null
      ? null
      : {
          amount: suggestedAmount,
          net: suggestedNet,
          netPerHour: perHour(suggestedNet),
          similarRange: context.similarRange,
        };

  return {
    price: context.price,
    currency: context.currency,
    net,
    netWorstCase,
    netPerHour,
    verdict,
    targetHourlyNet: costs.targetHourlyNet,
    hours: { likely: hoursLikely, worst: hoursWorst },
    distanceKm: km,
    breakdown,
    reasons: reasonsFor(context, netPerHour),
    warnings: warningsFor(context),
    suggestedQuote,
    confidence: work.confidence,
    basedOnJobs: work.basedOnJobs,
    modelVersion: work.modelVersion,
    costsAreDefaults: context.costsAreDefaults,
  };
}

function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

function reasonsFor(context: PriceContext, netPerHour: number | null): string[] {
  const { work, rule, costs } = context;
  const reasons: string[] = [];
  if (netPerHour !== null) {
    const target = `${costs.targetHourlyNet} ${context.currency}/h`;
    reasons.push(
      netPerHour >= costs.targetHourlyNet
        ? `Above your target of ${target}`
        : `Below your target of ${target}`,
    );
  }

  // The biggest pieces of the job, scaled like the final estimate.
  const scale = rule.hours > 0 ? work.likely / rule.hours : 1;
  rule.parts
    .filter((part) => part.hours * scale >= 0.25 && !part.label.startsWith('Getting set up'))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 2)
    .forEach((part) => reasons.push(`${part.label}: about ${formatHours(part.hours * scale)}`));

  if (work.modelFactor !== null && Math.abs(work.modelFactor - 1) >= 0.1) {
    reasons.push(
      `Similar finished jobs took ${percent(work.modelFactor)} ${
        work.modelFactor > 1 ? 'longer' : 'less time'
      } than the basic estimate`,
    );
  }
  if (work.moverFactor !== null && Math.abs(work.moverFactor - 1) >= 0.05) {
    reasons.push(
      `Your team usually works ${percent(work.moverFactor)} ${
        work.moverFactor < 1 ? 'faster' : 'slower'
      } than average`,
    );
  }
  return reasons;
}

function warningsFor(context: PriceContext): string[] {
  const warnings: string[] = [];
  if (context.trip.extraTrips > 0) {
    warnings.push(
      `The load is bigger than your largest vehicle: plan ${context.trip.extraTrips + 1} trips.`,
    );
  }
  if (!context.hasVehicle) {
    warnings.push('Add your vehicle in your profile so the estimate can check the load fits.');
  }
  if (context.trip.unknownDistance) {
    warnings.push('The distance is a rough guess for this route.');
  }
  return warnings;
}
