import {
  call,
  closeDatabase,
  createMover,
  createUser,
  dayFromNow,
  dispatched,
  JPEG,
  offerFor,
  PDF,
  resetDatabase,
  upload,
} from './helpers';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { GET as getAvailability, PUT as putAvailability } from '@/app/api/mover/availability/route';
import { GET as getProfile, PATCH as patchProfile } from '@/app/api/mover/profile/route';
import { POST as addVehicle } from '@/app/api/mover/vehicles/route';
import {
  DELETE as deleteVehicle,
  PATCH as patchVehicle,
} from '@/app/api/mover/vehicles/[id]/route';
import { POST as addMember } from '@/app/api/mover/team/route';
import { DELETE as deleteMember, PATCH as patchMember } from '@/app/api/mover/team/[id]/route';
import { POST as uploadDocument } from '@/app/api/mover/documents/route';
import { GET as dashboard } from '@/app/api/mover/dashboard/route';
import {
  GET as notifications,
  PATCH as readNotifications,
} from '@/app/api/mover/notifications/route';
import { POST as respond } from '@/app/api/mover/offers/[id]/respond/route';
import { GET as file } from '@/app/api/files/mover/route';
import { MoverDocumentModel, NotificationModel } from '@/server/shared/database/models';
import { sweep } from '@/server/modules/mover';

before(resetDatabase);
after(closeDatabase);
beforeEach(resetDatabase);

const today = dayFromNow(0);

describe('item 4: availability and zones (M-03)', () => {
  const put = (token: string, date: string, slot: string | null) =>
    call(putAvailability, { token, method: 'PUT', body: { date, slot } });

  it('sets, changes and clears a day, one slot per day', async () => {
    const mover = await createMover({ availableOn: [] });
    const date = dayFromNow(3);
    assert.equal((await put(mover.token, date, 'MORNING')).status, 200);
    assert.equal((await put(mover.token, date, 'FULL_DAY')).status, 200);
    const range = { from: today, to: dayFromNow(10) };
    let { data } = await call(getAvailability, { token: mover.token, query: range });
    assert.deepEqual(data.days, [{ date, slot: 'FULL_DAY' }]);

    assert.equal((await put(mover.token, date, null)).status, 200);
    ({ data } = await call(getAvailability, { token: mover.token, query: range }));
    assert.deepEqual(data.days, []);
  });

  it('allows today, refuses past days, impossible dates and unknown slots', async () => {
    const mover = await createMover({ availableOn: [] });
    assert.equal((await put(mover.token, today, 'MORNING')).status, 200);
    assert.equal((await put(mover.token, dayFromNow(-1), 'MORNING')).status, 422);
    assert.equal((await put(mover.token, '2027-02-31', 'MORNING')).status, 422);
    assert.equal((await put(mover.token, 'tomorrow', 'MORNING')).status, 422);
    assert.equal((await put(mover.token, dayFromNow(1), 'NIGHT')).status, 422);
  });

  it('only returns days inside the range, and only your own', async () => {
    const mover = await createMover({ availableOn: [dayFromNow(2), dayFromNow(20)] });
    const other = await createMover({ availableOn: [dayFromNow(2)] });
    const { data } = await call(getAvailability, {
      token: mover.token,
      query: { from: today, to: dayFromNow(5) },
    });
    assert.deepEqual(data.days, [{ date: dayFromNow(2), slot: 'FULL_DAY' }]);
    assert.ok(other);
    assert.equal(
      (await call(getAvailability, { token: mover.token, query: { from: 'x', to: today } })).status,
      422,
    );
    assert.equal(
      (
        await call(getAvailability, {
          token: mover.token,
          query: { from: today, to: dayFromNow(-2) },
        })
      ).status,
      400,
    );
  });

  it('updates zones, rejects unknown ones, and a change affects dispatch', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover({ zones: ['SFA'] });
    const first = await dispatched(client.id);
    assert.equal(first.offersSent, 0);

    const bad = await call(patchProfile, {
      token: mover.token,
      method: 'PATCH',
      body: { zones: ['MARS'] },
    });
    assert.equal(bad.status, 422);
    const good = await call(patchProfile, {
      token: mover.token,
      method: 'PATCH',
      body: { zones: ['TUN', 'SFA'] },
    });
    assert.deepEqual(good.data.profile.zones, ['TUN', 'SFA']);
    assert.equal((await dispatched(client.id)).offersSent, 1);
  });
});

describe('item 11: profile, vehicles, team and documents (M-10 + 9.3)', () => {
  it('reads and edits the profile without touching verification', async () => {
    const mover = await createMover();
    const updated = await call(patchProfile, {
      token: mover.token,
      method: 'PATCH',
      body: {
        companyName: 'New Name',
        bio: 'Careful movers',
        taxId: '123A',
        verificationStatus: 'APPROVED',
        ratingAvg: 5,
      },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.profile.companyName, 'New Name');
    assert.equal(updated.data.profile.ratingAvg, 4);
    assert.equal(updated.data.profile.availableZones.length, 6);
  });

  it('a pending mover cannot approve themselves through the profile route', async () => {
    const mover = await createMover({ verification: 'PENDING' });
    const response = await call(patchProfile, {
      token: mover.token,
      method: 'PATCH',
      body: { verificationStatus: 'APPROVED' },
    });
    assert.equal(response.status, 403);
  });

  it('rejects a too-short company name', async () => {
    const mover = await createMover();
    const response = await call(patchProfile, {
      token: mover.token,
      method: 'PATCH',
      body: { companyName: 'x' },
    });
    assert.equal(response.status, 422);
  });

  it('adds, edits and removes vehicles, and rejects bad input', async () => {
    const mover = await createMover();
    const created = await call(addVehicle, {
      token: mover.token,
      body: { type: 'VAN', capacityM3: 14, plate: '123 tun 4567' },
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.vehicle.plate, '123 TUN 4567');
    const id = created.data.vehicle.id;

    const edited = await call(patchVehicle, {
      token: mover.token,
      method: 'PATCH',
      params: { id },
      body: { type: 'LARGE_TRUCK', capacityM3: 40, plate: '9 TUN 9' },
    });
    assert.equal(edited.data.vehicle.type, 'LARGE_TRUCK');

    for (const body of [
      { type: 'BIKE', capacityM3: 1, plate: 'AA' },
      { type: 'VAN', capacityM3: 0, plate: 'AA' },
      { type: 'VAN', capacityM3: 1, plate: '' },
    ]) {
      assert.equal((await call(addVehicle, { token: mover.token, body })).status, 422);
    }

    assert.equal(
      (await call(deleteVehicle, { token: mover.token, method: 'DELETE', params: { id } })).status,
      200,
    );
    assert.equal(
      (await call(deleteVehicle, { token: mover.token, method: 'DELETE', params: { id } })).status,
      404,
    );
    assert.deepEqual((await call(getProfile, { token: mover.token })).data.profile.vehicles, []);
  });

  it("cannot touch another mover's vehicle or team member", async () => {
    const owner = await createMover();
    const other = await createMover();
    const vehicle = await call(addVehicle, {
      token: owner.token,
      body: { type: 'VAN', capacityM3: 14, plate: 'AB 1' },
    });
    const member = await call(addMember, { token: owner.token, body: { name: 'Sami' } });
    const params = (id: string) => ({ params: { id }, token: other.token });

    assert.equal(
      (
        await call(patchVehicle, {
          ...params(vehicle.data.vehicle.id),
          method: 'PATCH',
          body: { type: 'VAN', capacityM3: 1, plate: 'HACK' },
        })
      ).status,
      404,
    );
    assert.equal(
      (await call(deleteVehicle, { ...params(vehicle.data.vehicle.id), method: 'DELETE' })).status,
      404,
    );
    assert.equal(
      (
        await call(patchMember, {
          ...params(member.data.member.id),
          method: 'PATCH',
          body: { name: 'Hacked' },
        })
      ).status,
      404,
    );
    assert.equal(
      (await call(deleteMember, { ...params(member.data.member.id), method: 'DELETE' })).status,
      404,
    );

    const profile = (await call(getProfile, { token: owner.token })).data.profile;
    assert.equal(profile.vehicles[0].plate, 'AB 1');
    assert.equal(profile.team[0].name, 'Sami');
  });

  it('adds, edits and removes team members', async () => {
    const mover = await createMover();
    const created = await call(addMember, {
      token: mover.token,
      body: { name: 'Sami', phone: '+21655000000', role: 'Driver' },
    });
    assert.equal(created.status, 201);
    const id = created.data.member.id;
    const edited = await call(patchMember, {
      token: mover.token,
      method: 'PATCH',
      params: { id },
      body: { name: 'Sami B', role: 'Lead' },
    });
    assert.equal(edited.data.member.role, 'Lead');
    assert.equal((await call(addMember, { token: mover.token, body: { name: 'x' } })).status, 422);
    assert.equal(
      (await call(deleteMember, { token: mover.token, method: 'DELETE', params: { id } })).status,
      200,
    );
  });

  const send = (
    token: string,
    fields: Record<string, string>,
    bytes: Uint8Array = PDF,
    name = 'doc.pdf',
  ) => call(uploadDocument, { token, form: upload(fields, bytes, name) });

  it('uploading insurance unlocks offers, and replacing it keeps one record', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover({ insuranceDays: null });
    const before = await call(dashboard, { token: mover.token });
    assert.equal(before.data.eligibility.eligible, false);
    assert.match(before.data.eligibility.blockers[0], /insurance/i);
    assert.equal((await dispatched(client.id)).offersSent, 0);

    const first = await send(mover.token, { type: 'INSURANCE', expiresAt: dayFromNow(200) });
    assert.equal(first.status, 201);
    assert.equal(first.data.document.state, 'VALID');
    const fetched = await (file as (r: Request) => Promise<Response>)(
      new Request(new URL(first.data.document.url, 'http://test.local')),
    );
    assert.equal(fetched.status, 200);
    assert.equal(fetched.headers.get('content-type'), 'application/pdf');

    assert.equal(
      (await send(mover.token, { type: 'INSURANCE', expiresAt: dayFromNow(300) }, JPEG, 'scan.jpg'))
        .status,
      201,
    );
    assert.equal(
      await MoverDocumentModel.countDocuments({ moverId: mover.id, type: 'INSURANCE' }),
      1,
    );

    assert.equal((await call(dashboard, { token: mover.token })).data.eligibility.eligible, true);
    assert.equal((await dispatched(client.id)).offersSent, 1);
  });

  it('requires an expiry for insurance, a known type and a real document', async () => {
    const mover = await createMover({ insuranceDays: null });
    const missing = await send(mover.token, { type: 'INSURANCE' });
    assert.equal(missing.status, 422);
    assert.match(missing.data.message, /expiry/i);
    assert.equal((await send(mover.token, { type: 'PASSPORT' })).status, 422);
    assert.equal((await send(mover.token, { type: 'ID', expiresAt: '2027-02-31' })).status, 422);
    const fake = await send(
      mover.token,
      { type: 'ID' },
      new TextEncoder().encode('MZ executable'),
      'id.pdf',
    );
    assert.equal(fake.status, 400);
    assert.equal((await send(mover.token, { type: 'ID' })).status, 201);
  });

  it('a document stays valid through its whole expiry day', async () => {
    const mover = await createMover({ insuranceDays: null });
    const { data } = await send(mover.token, { type: 'INSURANCE', expiresAt: today });
    assert.equal(data.document.state, 'EXPIRING');
    assert.equal((await call(dashboard, { token: mover.token })).data.eligibility.eligible, true);
  });

  it('warns once at 30 days, on the dashboard and as a notification', async () => {
    const mover = await createMover({ insuranceDays: 25 });
    await sweep();
    await sweep();
    const warnings = await NotificationModel.find({ userId: mover.id, type: 'DOCUMENT_EXPIRING' });
    assert.equal(warnings.length, 1);
    const { data } = await call(dashboard, { token: mover.token });
    assert.equal(data.expiringDocuments.length, 1);
    assert.equal(data.expiringDocuments[0].daysLeft, 25);
    assert.equal(data.eligibility.eligible, true);
  });

  it('does not warn at 31 days, and warns again after a replacement nears expiry', async () => {
    const mover = await createMover({ insuranceDays: 31 });
    await sweep();
    assert.equal(
      await NotificationModel.countDocuments({ userId: mover.id, type: 'DOCUMENT_EXPIRING' }),
      0,
    );
    assert.equal((await call(dashboard, { token: mover.token })).data.expiringDocuments.length, 0);

    await send(mover.token, { type: 'INSURANCE', expiresAt: dayFromNow(10) });
    await sweep();
    await send(mover.token, { type: 'INSURANCE', expiresAt: dayFromNow(12) });
    await sweep();
    assert.equal(
      await NotificationModel.countDocuments({ userId: mover.id, type: 'DOCUMENT_EXPIRING' }),
      2,
    );
  });
});

describe('item 3: dashboard home', () => {
  it('brings together offers, upcoming jobs and earnings', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover({ availableOn: [dayFromNow(7), dayFromNow(8)] });
    const { moveId } = await dispatched(client.id);
    const offer = await offerFor(moveId, mover.id);
    await call(respond, {
      token: mover.token,
      params: { id: String(offer?._id) },
      body: { action: 'ACCEPT' },
    });
    await dispatched(client.id, { moveDate: dayFromNow(8) });

    const { status, data } = await call(dashboard, { token: mover.token });
    assert.equal(status, 200);
    assert.equal(data.offerCount, 1);
    assert.equal(data.offers.length, 1);
    assert.equal(data.upcomingJobs.length, 1);
    assert.equal(data.upcomingJobs[0].id, moveId);
    assert.equal(data.earnings.net, 0);
    assert.equal(data.eligibility.eligible, true);
  });

  it('is honest and empty for a brand new approved mover', async () => {
    const mover = await createMover();
    const { data } = await call(dashboard, { token: mover.token });
    assert.equal(data.offerCount, 0);
    assert.deepEqual(data.upcomingJobs, []);
    assert.equal(data.earnings.completedJobs, 0);
  });
});

describe('item 12: notifications (M-04)', () => {
  it('marks one or all as read, and never touches another user', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    const other = await createMover({ zones: ['SFA'] });
    await dispatched(client.id);
    await dispatched(client.id, { moveDate: dayFromNow(7), timeSlot: 'AFTERNOON' });
    await NotificationModel.create({ userId: other.id, type: 'PAYOUT', title: 'theirs' });

    let { data } = await call(notifications, { token: mover.token });
    assert.equal(data.unreadCount, 2);

    ({ data } = await call(readNotifications, {
      token: mover.token,
      method: 'PATCH',
      body: { ids: [data.notifications[0].id] },
    }));
    assert.equal(data.unreadCount, 1);

    const theirs = (await call(notifications, { token: other.token })).data.notifications[0].id;
    await call(readNotifications, {
      token: mover.token,
      method: 'PATCH',
      body: { ids: [theirs, 'not-an-id'] },
    });
    assert.equal((await call(notifications, { token: other.token })).data.unreadCount, 1);

    ({ data } = await call(readNotifications, { token: mover.token, method: 'PATCH', body: {} }));
    assert.equal(data.unreadCount, 0);
    assert.equal((await call(notifications, { token: other.token })).data.unreadCount, 1);
  });

  it('a pending mover can still read notifications', async () => {
    const mover = await createMover({ verification: 'PENDING' });
    assert.equal((await call(notifications, { token: mover.token })).status, 200);
  });
});
