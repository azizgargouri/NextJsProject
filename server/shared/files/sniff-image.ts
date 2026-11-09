/** Magic-byte signatures for the image types the app accepts. */
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
 * Identifies a PNG, JPEG or WebP image from its bytes, never from the
 * client-declared MIME type. Returns null for anything else.
 */
export function sniffImage(bytes: Uint8Array): { contentType: string; ext: string } | null {
  const match = SIGNATURES.find((signature) => signature.matches(bytes));
  return match ? { contentType: match.type, ext: match.ext } : null;
}
