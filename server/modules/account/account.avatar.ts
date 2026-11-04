import { PayloadTooLargeError, ValidationError } from '../../shared/database/errors';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const SIGNATURES: { type: string; ext: string; matches: (bytes: Uint8Array) => boolean }[] = [
  {
    type: 'image/png',
    ext: 'png',
    matches: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    type: 'image/jpeg',
    ext: 'jpg',
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: 'image/webp',
    ext: 'webp',
    matches: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
];

/**
 * Validates an uploaded avatar by its bytes, never by the client-declared MIME type.
 * Returns the sniffed content type and extension used for the object key.
 */
export function inspectAvatar(bytes: Uint8Array): { contentType: string; ext: string } {
  if (bytes.byteLength === 0) throw new ValidationError('The file is empty');
  if (bytes.byteLength > AVATAR_MAX_BYTES) {
    throw new PayloadTooLargeError('Avatars must be 2 MB or smaller');
  }
  const match = SIGNATURES.find((signature) => signature.matches(bytes));
  if (!match) throw new ValidationError('Avatars must be PNG, JPEG or WebP images');
  return { contentType: match.type, ext: match.ext };
}

export function avatarKey(userId: string, ext: string): string {
  return `avatars/${userId}/${Date.now()}.${ext}`;
}
