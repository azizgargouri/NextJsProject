import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  PLAYGROUND_DOMAIN,
  PLAYGROUND_MODULES,
  PLAYGROUND_PASSWORD,
  playgroundEnabled,
  playgroundStatus,
  resetPlayground,
  seedPlayground,
} from '@/server/modules/playground';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { ForbiddenError, ValidationError } from '@/server/shared/database/errors';

export const dynamic = 'force-dynamic';
// Seeding every module runs a few hundred writes; give it room on serverless hosts.
export const maxDuration = 60;

const RunSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('seed'), modules: z.array(z.enum(PLAYGROUND_MODULES)).optional() }),
  z.object({ action: z.literal('reset') }),
]);

function meta() {
  return {
    enabled: playgroundEnabled(),
    modules: PLAYGROUND_MODULES,
    domain: PLAYGROUND_DOMAIN,
    password: PLAYGROUND_PASSWORD,
  };
}

/** GET /api/admin/playground — what the seeder playground holds, per module. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ ...meta(), status: await playgroundStatus() });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/admin/playground — { action: 'seed', modules? } or { action: 'reset' }. */
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    if (!playgroundEnabled()) {
      throw new ForbiddenError('The playground is off in production (set PLAYGROUND_ENABLED=true)');
    }
    const parsed = RunSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      throw new ValidationError('Invalid playground action', parsed.error.flatten());
    const status =
      parsed.data.action === 'reset'
        ? await resetPlayground()
        : await seedPlayground(parsed.data.modules);
    return NextResponse.json({ ...meta(), status });
  } catch (error) {
    return errorResponse(error);
  }
}
