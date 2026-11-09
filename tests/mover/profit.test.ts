import {
  call,
  closeDatabase,
  createMove,
  createMover,
  createUser,
  dispatched,
  resetDatabase,
} from './helpers';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { GET as listOffers } from '@/app/api/mover/offers/route';
import { POST as respond } from '@/app/api/mover/offers/[id]/respond/route';
import { GET as getProfile, PATCH as patchProfile } from '@/app/api/mover/profile/route';
import {
  DurationModelModel,
  JobOfferModel,
  MoveRequestModel,
  StatusEventModel,
  VehicleModel,
} from '@/server/shared/database/models';
import {
  featureVector,
  fitDurationModel,
  predictWorkHours,
  shouldPromote,
  type DurationSample,
} from '@/server/modules/mover/mover.duration-model';
import { durationRepository } from '@/server/modules/mover/mover.duration-repository';
import {
  maybeRetrainDurationModel,
  trainDurationModel,
} from '@/server/modules/mover/mover.duration-training';
import {
  jobFacts,
  planTrip,
  priceJob,
  ruleWorkHours,
  verdictFor,
  zoneDistanceKm,
  type PriceContext,
} from '@/server/modules/mover/mover.profit';
import {
  forgetDurationModelCache,
  similarPriceRange,
} from '@/server/modules/mover/mover.profitability';
import { DEFAULT_MOVER_COSTS } from '@/server/modules/mover/mover.constants';
import type { MoveRequestDoc } from '@/server/shared/database/models';

before(resetDatabase);
after(closeDatabase);
beforeEach(async () => {
  await resetDatabase();
  forgetDurationModelCache();
});

const baseMove = {
  pickup: { zone: 'TUN' },
  dropoff: { zone: 'SOU' },
  volumeM3: 18,
  sizeRooms: 3,
  items: [],
  extraServices: [],
  timeSlot: 'MORNING',
  housingType: 'Apartment',
} as unknown as MoveRequestDoc;

function facts(overrides: Partial<MoveRequestDoc> = {}, helpers = 1, capacity: number | null = 20) {
  const move = { ...baseMove, ...overrides } as MoveRequestDoc;
  return jobFacts(move, planTrip(move, 'TUN', capacity), helpers);
}

function context(overrides: Partial<PriceContext> = {}): PriceContext {
  const trip = planTrip(baseMove, 'TUN', 20);
  return {
    price: 400,
    currency: 'TND',
    commissionRate: 0.15,
    costs: { ...DEFAULT_MOVER_COSTS },
    costsAreDefaults: true,
    trip,
    rule: { hours: 4, parts: [] },
    work: {
      likely: 4,
      worst: 5,
      modelFactor: null,
      moverFactor: null,
      confidence: 'ROUGH',
      basedOnJobs: 0,
      modelVersion: null,
    },
    similarRange: null,
    hasVehicle: true,
    ...overrides,
  };
}

describe('profitability rules', () => {
  it('reads zone distances both ways and knows a same-zone move is short', () => {
    assert.equal(zoneDistanceKm('TUN', 'SOU'), 140);
    assert.equal(zoneDistanceKm('SOU', 'TUN'), 140);
    assert.equal(zoneDistanceKm('TUN', 'TUN'), 15);
    assert.equal(zoneDistanceKm('TUN', 'XXX'), null);
  });

  it('counts the drive back to base and the extra trips when the load does not fit', () => {
    const oneTrip = planTrip(baseMove, 'TUN', 20);
    assert.equal(oneTrip.totalKm, 15 + 140 + 140);
    assert.equal(oneTrip.extraTrips, 0);

    const twoTrips = planTrip({ ...baseMove, volumeM3: 30 }, 'TUN', 20);
    assert.equal(twoTrips.extraTrips, 1);
    assert.equal(twoTrips.totalKm, oneTrip.totalKm + 2 * 140);
    assert.equal(planTrip(baseMove, 'XXX', 20).unknownDistance, true);
  });

  it('takes longer for items to take apart, and less long with more hands', () => {
    const plain = ruleWorkHours(facts()).hours;
    const withDisassembly = ruleWorkHours(
      facts({
        items: [
          {
            name: 'Wardrobe',
            quantity: 2,
            category: 'Furniture',
            isFragile: false,
            needsDisassembly: true,
          },
        ],
      }),
    ).hours;
    assert.ok(withDisassembly > plain);
    assert.ok(ruleWorkHours(facts({}, 3)).hours < plain);
  });

  it('leaves floors and elevators out of the estimate', () => {
    const ground = facts({ pickup: { zone: 'TUN', floor: 0, hasElevator: true } } as never);
    const sixth = facts({ pickup: { zone: 'TUN', floor: 6, hasElevator: false } } as never);
    assert.deepEqual(featureVector(ground), featureVector(sixth));
    assert.equal(ruleWorkHours(ground).hours, ruleWorkHours(sixth).hours);
  });

  it('works out the net from the price, commission, fuel, helpers and wear', () => {
    const result = priceJob(context());
    const km = 15 + 140 + 140;
    const driving = 15 / 25 + 140 / 65;
    const hours = Math.round((driving + 4) * 100) / 100;
    assert.equal(result.hours.likely, hours);
    const fuel = (km * 12 * 2.2) / 100;
    const expected = 400 * 0.85 - fuel - 8 * hours - km * 0.15;
    assert.ok(Math.abs((result.net ?? 0) - expected) < 0.01, `net ${result.net} vs ${expected}`);
    assert.ok((result.netWorstCase ?? 0) < (result.net ?? 0));
    assert.equal(result.breakdown[0]?.label, 'Price');
    assert.equal(result.suggestedQuote, null);
  });

  it('rates a job against the mover target', () => {
    assert.equal(verdictFor(30, 25), 'GOOD');
    assert.equal(verdictFor(20, 25), 'OK');
    assert.equal(verdictFor(10, 25), 'LOW');
    assert.equal(verdictFor(-5, 25), 'LOW');
  });

  it('suggests a quote that covers a long day and the target, before commission', () => {
    const result = priceJob(context({ price: null }));
    assert.equal(result.net, null);
    assert.equal(result.verdict, null);
    const quote = result.suggestedQuote;
    assert.ok(quote);
    assert.equal(quote.amount % 5, 0);
    // Covering a long day at the target means beating the target on a normal day.
    assert.ok(quote.netPerHour >= result.targetHourlyNet, `${quote.netPerHour} per hour`);

    // The money is laid out against the suggested price, and adds up to what is kept.
    assert.equal(result.breakdown[0]?.kind, 'PRICE');
    assert.equal(result.breakdown[0]?.label, 'Suggested price');
    const left = result.breakdown.reduce((total, line) => total + line.amount, 0);
    assert.ok(Math.abs(left - quote.net) < 0.01, `${left} vs ${quote.net}`);
  });

  it('gives the middle of what similar jobs paid, or nothing without enough of them', () => {
    const job = { volumeM3: 18, transitKm: 140, sizeRooms: 3 };
    const history = [300, 350, 400, 450, 500].map((price) => ({ ...job, price }));
    assert.deepEqual(similarPriceRange(job, history), { low: 350, high: 450 });
    assert.equal(similarPriceRange(job, history.slice(0, 2)), null);
    assert.equal(
      similarPriceRange(job, [{ volumeM3: 90, transitKm: 400, sizeRooms: 9, price: 1 }]),
      null,
    );
  });
});

describe('duration model', () => {
  /** Jobs where items to take apart really cost twice what the rules think, and one team is faster. */
  function samples(count: number): DurationSample[] {
    return Array.from({ length: count }, (_, index) => {
      const disassembly = index % 5;
      const job = facts({
        volumeM3: 8 + (index % 7) * 4,
        items: [
          {
            name: 'Bed',
            quantity: disassembly,
            category: 'Furniture',
            isFragile: false,
            needsDisassembly: true,
          },
        ],
      });
      const features = featureVector(job);
      const ruleHours = ruleWorkHours(job).hours;
      const moverId = index % 2 === 0 ? 'fast' : 'usual';
      const truth = 0.1 + 0.8 * features[4]! + (moverId === 'fast' ? -0.2 : 0);
      return {
        moverId,
        features,
        ruleHours,
        actualHours: ruleHours * Math.exp(truth),
        finishedAt: new Date(2026, 0, 1 + index),
      };
    });
  }

  it('learns the weight the rules got wrong, and each team pace', () => {
    const params = fitDurationModel(samples(200));
    assert.ok(Math.abs(params.weights[4]! - 0.8) < 0.15, `disassembly weight ${params.weights[4]}`);
    const fast = params.moverOffsets.fast!.offset;
    const usual = params.moverOffsets.usual!.offset;
    assert.ok(fast < usual, 'the fast team should get a lower offset');
  });

  it('uses the basic estimate without a model, with a wider worst case', () => {
    const plain = predictWorkHours(null, 4, featureVector(facts()), 'anyone');
    assert.equal(plain.likely, 4);
    assert.ok(plain.worst > plain.likely);
  });

  it('only promotes a model that beats the rules and the live model', () => {
    assert.equal(shouldPromote({ modelMae: 1, baselineMae: 2, previous: null }), true);
    assert.equal(shouldPromote({ modelMae: 2, baselineMae: 2, previous: null }), false);
    assert.equal(
      shouldPromote({ modelMae: 1, baselineMae: 2, previous: { liveMae: 0.5, candidateMae: 0.8 } }),
      false,
    );
    assert.equal(
      shouldPromote({ modelMae: 1, baselineMae: 2, previous: { liveMae: 0.8, candidateMae: 0.8 } }),
      true,
    );
  });
});

/** Finished jobs with real start and end times, as the app would have recorded them. */
async function finishedJobs(moverId: string, clientId: string, count: number, slowdown: number) {
  await VehicleModel.create({ moverId, type: 'VAN', capacityM3: 40, plate: '1 TUN 1' });
  for (let index = 0; index < count; index += 1) {
    const moveId = String((await createMove(clientId))._id);
    const volumeM3 = 6 + (index % 6) * 5;
    const end = new Date(Date.UTC(2026, 0, 1 + index, 16));
    await MoveRequestModel.updateOne(
      { _id: moveId },
      {
        $set: {
          status: 'COMPLETED',
          assignedMoverId: moverId,
          finalPrice: 300 + volumeM3 * 5,
          volumeM3,
          deliveredAt: end,
          completedAt: end,
        },
      },
    );
    const move = (await MoveRequestModel.findById(moveId).lean()) as MoveRequestDoc;
    const job = jobFacts(move, planTrip(move, move.pickup.zone, 40), DEFAULT_MOVER_COSTS.helpers);
    const hours = ruleWorkHours(job).hours * slowdown * (index % 2 ? 1.05 : 0.95);
    const start = new Date(end.getTime() - hours * 3_600_000);
    await StatusEventModel.collection.insertMany([
      {
        moveId,
        fromStatus: 'EN_ROUTE',
        toStatus: 'IN_PROGRESS',
        note: '',
        actorId: moverId,
        createdAt: start,
        updatedAt: start,
      },
      {
        moveId,
        fromStatus: 'IN_PROGRESS',
        toStatus: 'DELIVERED',
        note: '',
        actorId: moverId,
        createdAt: end,
        updatedAt: end,
      },
    ]);
  }
}

describe('profitability on offers', () => {
  it('comes with every offer, and uses default costs until the mover enters theirs', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    await dispatched(client.id);

    const { data } = await call(listOffers, { token: mover.token });
    const profit = data.offers[0].profitability;
    assert.equal(profit.price, 400);
    assert.equal(profit.costsAreDefaults, true);
    assert.equal(profit.confidence, 'ROUGH');
    assert.equal(profit.modelVersion, null);
    assert.ok(['GOOD', 'OK', 'LOW'].includes(profit.verdict));
    assert.ok(profit.warnings.some((warning: string) => warning.includes('Add your vehicle')));
  });

  it('uses the costs the mover saves, and goes back to the defaults on request', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    await dispatched(client.id);
    const before = (await call(listOffers, { token: mover.token })).data.offers[0].profitability;

    const costs = { ...DEFAULT_MOVER_COSTS, helpers: 3, helperHourlyRate: 20 };
    const saved = await call(patchProfile, {
      token: mover.token,
      method: 'PATCH',
      body: { costs },
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.profile.costsAreDefaults, false);
    assert.deepEqual(saved.data.profile.costs, costs);

    const after = (await call(listOffers, { token: mover.token })).data.offers[0].profitability;
    assert.ok(after.net < before.net, 'more paid helpers leave less');

    const invalid = await call(patchProfile, {
      token: mover.token,
      method: 'PATCH',
      body: { costs: { ...costs, helpers: -1 } },
    });
    assert.equal(invalid.status, 422);

    await call(patchProfile, { token: mover.token, method: 'PATCH', body: { costs: null } });
    const reset = await call(getProfile, { token: mover.token });
    assert.equal(reset.data.profile.costsAreDefaults, true);
  });

  it('keeps the estimate the mover saw when they accept', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    const { moveId } = await dispatched(client.id);
    const offer = await JobOfferModel.findOne({ moveId, moverId: mover.id }).lean();
    await call(respond, {
      token: mover.token,
      params: { id: String(offer?._id) },
      body: { action: 'ACCEPT' },
    });
    const kept = await JobOfferModel.findById(offer?._id).lean();
    assert.ok(kept?.estimate, 'expected a recorded estimate');
    assert.ok(kept.estimate.workHoursWorst > kept.estimate.workHoursLikely);
    assert.equal(kept.estimate.modelVersion, null);
  });
});

describe('training the duration model', () => {
  it('waits until there are enough finished jobs', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    await finishedJobs(mover.id, client.id, 10, 1.5);

    await maybeRetrainDurationModel();
    assert.equal(await DurationModelModel.countDocuments(), 0);
    const outcome = await trainDurationModel();
    assert.equal(outcome.status, 'SKIPPED');
  });

  it('learns that jobs run long, goes live and is used for new offers', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    await finishedJobs(mover.id, client.id, 40, 1.5);

    await maybeRetrainDurationModel();
    const live = await DurationModelModel.findOne({ status: 'LIVE' }).lean();
    assert.ok(live, 'expected a live model');
    assert.equal(live.sampleSize, 40);
    assert.ok(live.modelMae < live.baselineMae);

    await dispatched(client.id);
    const { data } = await call(listOffers, { token: mover.token });
    const profit = data.offers[0].profitability;
    assert.equal(profit.modelVersion, live.version);
    assert.equal(profit.basedOnJobs, 40);
    assert.equal(profit.confidence, 'GOOD');
    assert.ok(
      profit.reasons.some((reason: string) => reason.includes('longer than the basic estimate')),
      profit.reasons.join(' | '),
    );
    assert.ok(profit.suggestedQuote === null);
  });

  it('lets only one server train at a time', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    await finishedJobs(mover.id, client.id, 35, 1.5);

    assert.equal(await durationRepository.claimTrainingLock(new Date(), 60_000), true);
    const outcome = await trainDurationModel();
    assert.equal(outcome.status, 'SKIPPED');
    assert.equal(await DurationModelModel.countDocuments(), 0);
  });
});
