/**
 * Box labels, shared by the label sheet, the scanner and the server.
 *
 * Labels printed by the app carry the move reference and a box number, so a
 * label from another move is refused at the door. Any other QR code, such as a
 * pre-printed sticker roll, is accepted as it is.
 */
export const BOX_LABEL_PREFIX = 'MOVEUP';
export const MAX_BOX_CODE_LENGTH = 200;
export const MAX_LABELS_PER_SHEET = 200;

const APP_LABEL = /^MOVEUP:([A-Z0-9-]+):(\d{1,4})$/;
const SHORT_LABEL_LENGTH = 24;

export function boxLabelCode(reference: string, boxNumber: number): string {
  return `${BOX_LABEL_PREFIX}:${reference}:${String(boxNumber).padStart(3, '0')}`;
}

export type ParsedBoxCode =
  { ok: true; code: string; label: string } | { ok: false; message: string };

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const point = character.charCodeAt(0);
    return point < 32 || point === 127;
  });
}

/** Turns what the camera read into the code to store and a short name to show. */
export function parseBoxCode(raw: string, reference: string): ParsedBoxCode {
  const code = raw.trim();
  if (!code) return { ok: false, message: 'This label has no code' };
  if (code.length > MAX_BOX_CODE_LENGTH || hasControlCharacters(code)) {
    return { ok: false, message: 'This is not a box label' };
  }

  const appLabel = APP_LABEL.exec(code);
  if (appLabel) {
    if (appLabel[1] !== reference) {
      return { ok: false, message: `This label belongs to move ${appLabel[1]}` };
    }
    return { ok: true, code, label: `Box ${Number(appLabel[2])}` };
  }

  const label =
    code.length > SHORT_LABEL_LENGTH ? `${code.slice(0, SHORT_LABEL_LENGTH - 1)}…` : code;
  return { ok: true, code, label };
}
