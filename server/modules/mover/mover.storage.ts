import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env';
import { FILE_URL_TTL_SECONDS } from './mover.constants';

/**
 * Local private storage for mover photos and documents. It has the same
 * putObject/getObject shape as server/shared/storage/s3.ts on origin/main, so
 * connecting S3 means swapping this object. Files sit outside /public and are
 * reachable only through a short-lived signed URL.
 */
const KEY_PATTERN = /^mover\/[a-f0-9]{24}\/[a-z]+\/[a-f0-9-]{36}\.(jpg|png|webp|pdf)$/;

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

function resolveKey(key: string): string {
  if (!KEY_PATTERN.test(key)) throw new Error('Invalid storage key');
  return path.resolve(env().UPLOAD_DIR, key);
}

export const moverStorage = {
  newKey(moverId: string, folder: string, extension: string): string {
    return `mover/${moverId}/${folder}/${randomUUID()}.${extension}`;
  },

  async putObject(key: string, body: Uint8Array): Promise<void> {
    const target = resolveKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  },

  async getObject(key: string): Promise<{ body: Uint8Array; contentType: string }> {
    const body = await readFile(resolveKey(key));
    const extension = key.split('.').pop() ?? '';
    return { body, contentType: CONTENT_TYPES[extension] ?? 'application/octet-stream' };
  },
};

function signature(key: string, expires: number): string {
  return createHmac('sha256', `mover-files:${env().JWT_SECRET}`)
    .update(`${key}\n${expires}`)
    .digest('hex');
}

export function signFileUrl(key: string, now: number = Date.now()): string {
  const expires = Math.floor(now / 1000) + FILE_URL_TTL_SECONDS;
  const query = new URLSearchParams({
    key,
    exp: String(expires),
    sig: signature(key, expires),
  });
  return `/api/files/mover?${query.toString()}`;
}

export function verifyFileSignature(
  key: string | null,
  exp: string | null,
  sig: string | null,
  now: number = Date.now(),
): key is string {
  if (!key || !exp || !sig || !KEY_PATTERN.test(key)) return false;
  const expires = Number(exp);
  if (!Number.isInteger(expires) || expires * 1000 <= now) return false;
  const expected = Buffer.from(signature(key, expires));
  const received = Buffer.from(sig);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
