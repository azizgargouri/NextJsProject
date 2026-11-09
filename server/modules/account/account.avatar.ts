import { PayloadTooLargeError, ValidationError } from '../../shared/database/errors';
import { sniffImage } from '../../shared/files/sniff-image';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Validates an uploaded avatar by its bytes, never by the client-declared MIME type.
 * Returns the sniffed content type and extension used for the object key.
 */
export function inspectAvatar(bytes: Uint8Array): { contentType: string; ext: string } {
  if (bytes.byteLength === 0) throw new ValidationError('The file is empty');
  if (bytes.byteLength > AVATAR_MAX_BYTES) {
    throw new PayloadTooLargeError('Avatars must be 2 MB or smaller');
  }
  const match = sniffImage(bytes);
  if (!match) throw new ValidationError('Avatars must be PNG, JPEG or WebP images');
  return match;
}

export function avatarKey(userId: string, ext: string): string {
  return `avatars/${userId}/${Date.now()}.${ext}`;
}
