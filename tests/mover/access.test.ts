import { call, closeDatabase, createMover, createUser, resetDatabase } from './helpers';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { GET as application } from '@/app/api/mover/application/route';
import { GET as dashboard } from '@/app/api/mover/dashboard/route';
import { GET as offers } from '@/app/api/mover/offers/route';
import { POST as respond } from '@/app/api/mover/offers/[id]/respond/route';
import { GET as jobs } from '@/app/api/mover/jobs/route';
import { GET as earnings } from '@/app/api/mover/earnings/route';
import { GET as profile } from '@/app/api/mover/profile/route';
import { GET as availability } from '@/app/api/mover/availability/route';
import { GET as notifications } from '@/app/api/mover/notifications/route';
import { POST as vehicles } from '@/app/api/mover/vehicles/route';
import { generateAccessToken } from '@/server/shared/auth/jwt';

const LOCKED_ROUTES: [string, unknown][] = [
  ['dashboard', dashboard],
  ['offers', offers],
  ['jobs', jobs],
  ['earnings', earnings],
  ['profile', profile],
];

before(resetDatabase);
after(closeDatabase);

describe('item 2: application status and dashboard lock (M-02)', () => {
  for (const verification of ['PENDING', 'REJECTED', 'SUSPENDED'] as const) {
    it(`${verification} mover sees the status but every workspace route is locked`, async () => {
      const mover = await createMover({ verification });
      const status = await call(application, { token: mover.token });
      assert.equal(status.status, 200);
      assert.equal(status.data.application.status, verification);
      assert.equal(status.data.application.canAccessDashboard, false);

      for (const [name, route] of LOCKED_ROUTES) {
        const response = await call(route, { token: mover.token });
        assert.equal(response.status, 403, `${name} should be locked`);
      }
      const write = await call(vehicles, {
        token: mover.token,
        body: { type: 'VAN', capacityM3: 10, plate: 'X' },
      });
      assert.equal(write.status, 403);
    });
  }

  it('APPROVED mover gets in', async () => {
    const mover = await createMover();
    const status = await call(application, { token: mover.token });
    assert.equal(status.data.application.canAccessDashboard, true);
    for (const [name, route] of LOCKED_ROUTES) {
      assert.equal((await call(route, { token: mover.token })).status, 200, name);
    }
  });

  it('a mover with no profile yet (fresh sign-up) becomes PENDING, not approved', async () => {
    const mover = await createUser('MOVER');
    assert.equal((await call(dashboard, { token: mover.token })).status, 403);
    const status = await call(application, { token: mover.token });
    assert.equal(status.status, 200);
    assert.equal(status.data.application.status, 'PENDING');
    assert.equal(status.data.application.companyName, mover.name);
    const again = await call(application, { token: mover.token });
    assert.equal(again.data.application.submittedAt, status.data.application.submittedAt);
    assert.equal((await call(dashboard, { token: mover.token })).status, 403);
  });
});

describe('role checks on every route', () => {
  const ALL: [string, unknown][] = [
    ...LOCKED_ROUTES,
    ['application', application],
    ['notifications', notifications],
    ['availability', availability],
  ];

  it('no token is a 401', async () => {
    for (const [name, route] of ALL) {
      assert.equal((await call(route)).status, 401, name);
    }
  });

  it('a garbage token is a 401', async () => {
    assert.equal((await call(offers, { token: 'not-a-jwt' })).status, 401);
  });

  it('clients and admins are refused', async () => {
    const client = await createUser('CLIENT');
    const admin = await createUser('ADMIN');
    for (const [name, route] of ALL) {
      assert.equal((await call(route, { token: client.token })).status, 403, `client ${name}`);
      assert.equal((await call(route, { token: admin.token })).status, 403, `admin ${name}`);
    }
  });

  it('a blocked approved mover is refused', async () => {
    const mover = await createMover({ userStatus: 'BLOCKED' });
    assert.equal((await call(offers, { token: mover.token })).status, 403);
  });

  it('the database role wins over a forged role in a validly signed token', async () => {
    const client = await createUser('CLIENT');
    const forged = await generateAccessToken({
      sub: client.id,
      email: 'x@test.local',
      role: 'MOVER',
    });
    assert.equal((await call(offers, { token: forged })).status, 403);
  });

  it('a locked mover cannot answer an offer by calling the route directly', async () => {
    const mover = await createMover({ verification: 'PENDING' });
    const response = await call(respond, {
      token: mover.token,
      params: { id: '507f1f77bcf86cd799439011' },
      body: { action: 'ACCEPT' },
    });
    assert.equal(response.status, 403);
  });
});
