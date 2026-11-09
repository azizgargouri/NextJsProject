import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { errorResponse, requireRole } from '../../shared/auth/guards';
import type { AccessTokenPayload } from '../../shared/auth/jwt';
import { ForbiddenError, ValidationError } from '../../shared/database/errors';
import { moverRepository } from './mover.repository';

type Context<P> = { params: Promise<P> };
interface HandlerArgs<P> {
  request: Request;
  actor: AccessTokenPayload;
  params: P;
}
type Handler<P> = (args: HandlerArgs<P>) => Promise<unknown>;

/** Wraps a handler with the role check and the shared error mapping. */
function route<P>(guard: (request: Request) => Promise<AccessTokenPayload>, handler: Handler<P>) {
  return async (request: Request, context: Context<P>): Promise<Response> => {
    try {
      const actor = await guard(request);
      const result = await handler({ request, actor, params: await context.params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (error) {
      if (!(error instanceof Error && 'status' in error)) console.error('[mover]', error);
      return errorResponse(error);
    }
  };
}

/** M-02: everything except the application status screen needs an approved mover. */
async function requireApprovedMover(request: Request): Promise<AccessTokenPayload> {
  const actor = await requireRole(request, ['MOVER']);
  const profile = await moverRepository.findProfile(actor.sub);
  if (profile?.verificationStatus !== 'APPROVED') {
    throw new ForbiddenError('Your mover application has not been approved');
  }
  return actor;
}

export const anyMoverRoute = <P = unknown>(handler: Handler<P>) =>
  route<P>((request) => requireRole(request, ['MOVER']), handler);

export const approvedMoverRoute = <P = unknown>(handler: Handler<P>) =>
  route<P>(requireApprovedMover, handler);

export const clientRoute = <P = unknown>(handler: Handler<P>) =>
  route<P>((request) => requireRole(request, ['CLIENT']), handler);

/** Chat is shared; approval is enforced separately for movers. */
export const chatRoute = <P = unknown>(handler: Handler<P>) =>
  route<P>(async (request) => {
    const actor = await requireRole(request, ['CLIENT', 'MOVER', 'ADMIN']);
    return actor.role === 'MOVER' ? requireApprovedMover(request) : actor;
  }, handler);

export function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const first =
      flat.formErrors[0] ??
      Object.values(flat.fieldErrors as Record<string, string[] | undefined>)[0]?.[0];
    throw new ValidationError(first ?? 'Invalid request', flat);
  }
  return parsed.data;
}

export async function parseJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  return parse(schema, await request.json().catch(() => null));
}

/** Rejects oversized bodies before they are buffered, then reads one uploaded file. */
export async function readUpload(
  request: Request,
  maxBytes: number,
): Promise<{ form: FormData; bytes: Uint8Array; name: string }> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBytes + 1024 * 1024) throw new ValidationError('This file is over 8 MB');

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!form || !(file instanceof File) || file.size === 0) {
    throw new ValidationError('Choose a file to upload');
  }
  if (file.size > maxBytes) throw new ValidationError('This file is over 8 MB');
  return { form, bytes: new Uint8Array(await file.arrayBuffer()), name: file.name };
}
