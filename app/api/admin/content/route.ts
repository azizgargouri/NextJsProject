import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ContentService } from '@/server/modules/content';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { ValidationError } from '@/server/shared/database/errors';
import { EventType, logEvent } from '@/server/shared/logger/audit';

const ContentSaveSchema = z.object({
  locale: z.enum(['en', 'fr', 'ar']),
  entries: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .max(32)
    .nonempty(),
});

const ContentResetSchema = z.object({
  locale: z.enum(['en', 'fr', 'ar']),
  keys: z.array(z.string()).nonempty(),
});

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const locale = url.searchParams.get('locale') ?? 'en';
    if (locale !== 'en' && locale !== 'fr' && locale !== 'ar') {
      throw new ValidationError('Unsupported locale');
    }
    return NextResponse.json({ locale, sections: await new ContentService().adminBundle(locale) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAdmin(request);
    const body = await request.json().catch(() => null);
    const mod = urlOp(request).searchParams.get('mode');

    if (mod === 'reset') {
      const parsed = ContentResetSchema.safeParse(body);
      if (!parsed.success)
        throw new ValidationError('Invalid reset payload', parsed.error.flatten());
      const count = await new ContentService().resetEntriesActor(
        actor.sub,
        parsed.data.locale,
        parsed.data.keys,
      );
      logEvent({
        event: EventType.CONTENT_UPDATE,
        userId: actor.sub,
        method: 'PATCH',
        api: '/api/admin/content?mode=reset',
        logInfo: { locale: parsed.data.locale, resetKeys: count },
      });
      return NextResponse.json({ locale: parsed.data.locale, reset: count });
    }

    const parsed = ContentSaveSchema.safeParse(body);
    if (!parsed.success)
      throw new ValidationError('Invalid content payload', parsed.error.flatten());
    const saved = await new ContentService().saveEntries(
      actor.sub,
      parsed.data.locale,
      parsed.data.entries.map((entry) => ({ key: entry.key, value: entry.value })),
    );
    logEvent({
      event: EventType.CONTENT_UPDATE,
      userId: actor.sub,
      method: 'PATCH',
      api: '/api/admin/content',
      logInfo: { locale: parsed.data.locale, savedKeys: saved },
    });
    return NextResponse.json({ locale: parsed.data.locale, saved });
  } catch (error) {
    return errorResponse(error);
  }
}

function urlOp(request: Request): URL {
  return new URL(request.url);
}
