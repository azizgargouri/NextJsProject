import { closeDatabase, createMover, createUser, resetDatabase } from './helpers';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import { AuthRepository } from '@/server/modules/auth/auth.repository';
import { runMoverAction } from '@/server/modules/mover/mover.action-core';
import { sha256Hex } from '@/server/shared/auth/jwt';
import { NotFoundError } from '@/server/shared/database/errors';
import { RefreshTokenModel } from '@/server/shared/database/models';

before(resetDatabase);
after(closeDatabase);
beforeEach(resetDatabase);

async function sessionFor(userId: string): Promise<string> {
  const raw = randomBytes(32).toString('hex');
  await new AuthRepository().saveToken({ userId, tokenHash: sha256Hex(raw), ttlSeconds: 3600 });
  return raw;
}

const whoAmI = (token: string | null) => runMoverAction(token, async (moverId) => moverId);

describe('Server Action authentication', () => {
  it('runs the work as the approved mover who owns the cookie', async () => {
    const mover = await createMover();
    assert.deepEqual(await whoAmI(await sessionFor(mover.id)), { ok: true, data: mover.id });
  });

  it('refuses a missing or unknown cookie, without running the work', async () => {
    let ran = false;
    const work = async () => {
      ran = true;
    };
    for (const token of [null, '', 'made-up-token']) {
      const result = await runMoverAction(token, work);
      assert.equal(result.ok, false);
      assert.equal(result.ok === false && result.code, 'UNAUTHORIZED');
    }
    assert.equal(ran, false);
  });

  it('refuses a revoked session, as after sign-out', async () => {
    const mover = await createMover();
    const token = await sessionFor(mover.id);
    await RefreshTokenModel.updateOne(
      { tokenHash: sha256Hex(token) },
      { $set: { revokedAt: new Date() } },
    );
    const result = await whoAmI(token);
    assert.equal(result.ok === false && result.code, 'UNAUTHORIZED');
  });

  it('refuses an expired session', async () => {
    const mover = await createMover();
    const token = await sessionFor(mover.id);
    await RefreshTokenModel.updateOne(
      { tokenHash: sha256Hex(token) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    const result = await whoAmI(token);
    assert.equal(result.ok === false && result.code, 'UNAUTHORIZED');
  });

  for (const verification of ['PENDING', 'REJECTED', 'SUSPENDED'] as const) {
    it(`refuses a ${verification} mover`, async () => {
      const mover = await createMover({ verification });
      const result = await whoAmI(await sessionFor(mover.id));
      assert.equal(result.ok === false && result.code, 'FORBIDDEN');
    });
  }

  it('refuses a blocked mover, clients and admins', async () => {
    const accounts = [
      await createMover({ userStatus: 'BLOCKED' }),
      await createUser('CLIENT'),
      await createUser('ADMIN'),
    ];
    for (const account of accounts) {
      const result = await whoAmI(await sessionFor(account.id));
      assert.equal(result.ok === false && result.code, 'FORBIDDEN');
    }
  });
});

describe('Server Action results', () => {
  it('passes a domain error message through to the mover', async () => {
    const mover = await createMover();
    const result = await runMoverAction(await sessionFor(mover.id), async () => {
      throw new NotFoundError('Job');
    });
    assert.deepEqual(result, { ok: false, message: 'Job not found', code: 'JOB_NOT_FOUND' });
  });

  it('hides the details of an unexpected error', async () => {
    const mover = await createMover();
    const original = console.error;
    console.error = () => undefined;
    try {
      const result = await runMoverAction(await sessionFor(mover.id), async () => {
        throw new Error('mongodb://secret-host failed');
      });
      assert.equal(result.ok, false);
      assert.ok(!JSON.stringify(result).includes('secret-host'));
    } finally {
      console.error = original;
    }
  });
});
