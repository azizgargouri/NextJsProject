/**
 * Smart Room Layout reads the client's real Moves (in-memory Mongo, no network).
 * Run: yarn test
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { mongoose } from '../server/shared/database/mongoose';
import { MoveModel } from '../server/shared/database/models/move.model';
import { MoveCreateSchema } from '../server/modules/moves/moves.schema';
import { movesService } from '../server/modules/moves/moves.service';
import { moveRequestsService } from '../server/modules/room-layout/move-requests.service';

const items = [
  { id: 'bed', name: 'Double Bed', volume: 1.8, weight: 55, quantity: 1 },
  { id: 'box', name: 'Moving box', volume: 0.08, weight: 12, quantity: 5 },
];
const booking = { pickupAddress: '12 Rue du Lac', destinationAddress: '8 Av. Bourguiba', distance: 12, items };

let server: MongoMemoryServer;
before(async () => {
  server = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  process.env.MONGODB_URI = server.getUri();
  process.env.JWT_SECRET ??= 'test-secret-that-is-at-least-32-chars';
});
after(async () => {
  await mongoose.disconnect();
  await server.stop();
});

describe('smart room move requests', () => {
  it('lists only the client’s own moves, with the booked day', async () => {
    const { reference } = await movesService.create({ ...booking, moveDate: '2026-12-01' }, 'client-a');

    const [request] = await moveRequestsService.listForClient({ id: 'client-a' });
    assert.equal(request?.reference, reference);
    assert.equal(request?.moveDate, '2026-12-01');
    assert.deepEqual(await moveRequestsService.listForClient({ id: 'client-b' }), []);
    assert.equal(await moveRequestsService.findForClient({ id: 'client-b' }, reference), null);

    const expanded = moveRequestsService.expand(request!);
    assert.equal(expanded.items.length, 2);
    assert.equal(expanded.items[0]?.volumeM3, 1.8);
    assert.ok(expanded.items[0]?.footprint);
  });

  it('falls back to the booking day for moves without a moveDate', async () => {
    const { reference } = await movesService.create(booking, 'client-c');
    const move = await MoveModel.findOne({ reference }).lean();
    const request = await moveRequestsService.findForClient({ id: 'client-c' }, reference);
    assert.equal(move?.moveDate, null);
    assert.equal(request?.moveDate, move!.createdAt.toISOString().slice(0, 10));
  });

  it('rejects an invalid moveDate at the API boundary', () => {
    assert.equal(MoveCreateSchema.safeParse({ ...booking, moveDate: '2026-13-45' }).success, false);
    assert.equal(MoveCreateSchema.safeParse({ ...booking, moveDate: '2026-12-01' }).success, true);
  });
});
