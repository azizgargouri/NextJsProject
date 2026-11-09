import type {
  DocumentType,
  MoveStatus,
  ProgressStage,
  TimeSlot,
} from '../../shared/database/enums';
import type { JobAction } from '../../../types/mover';
import { DOCUMENT_WARNING_DAYS } from './mover.constants';

/** Pure business rules (no I/O), so they can be tested exhaustively. */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar day in Tunisia as YYYY-MM-DD, regardless of the server's time zone. */
export function todayInTunis(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(now);
}

export function slotCovers(available: TimeSlot, required: TimeSlot): boolean {
  return available === 'FULL_DAY' || available === required;
}

export function slotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
  return a === 'FULL_DAY' || b === 'FULL_DAY' || a === b;
}

export interface DocumentFacts {
  type: DocumentType;
  expiresAt: Date | null;
}

export function documentState(
  expiresAt: Date | null,
  now: Date = new Date(),
): { state: 'VALID' | 'EXPIRING' | 'EXPIRED'; daysLeft: number | null } {
  if (!expiresAt) return { state: 'VALID', daysLeft: null };
  const remaining = expiresAt.getTime() - now.getTime();
  const daysLeft = Math.ceil(remaining / DAY_MS);
  if (remaining <= 0) return { state: 'EXPIRED', daysLeft: Math.min(daysLeft, 0) };
  return { state: daysLeft <= DOCUMENT_WARNING_DAYS ? 'EXPIRING' : 'VALID', daysLeft };
}

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  ID: 'ID',
  LICENCE: 'Licence',
  INSURANCE: 'Insurance',
  REGISTRATION: 'Vehicle registration',
};

/** Spec 9.3: only movers with valid documents (insurance not expired) get offers. */
export function documentBlockers(documents: DocumentFacts[], now: Date = new Date()): string[] {
  const blockers: string[] = [];
  if (!documents.some((document) => document.type === 'INSURANCE')) {
    blockers.push('Upload your insurance document to receive offers.');
  }
  for (const document of documents) {
    if (documentState(document.expiresAt, now).state === 'EXPIRED') {
      blockers.push(`Your ${DOCUMENT_LABELS[document.type].toLowerCase()} has expired.`);
    }
  }
  return blockers;
}

export function matchesMove(
  mover: { zones: string[]; availability: { date: string; slot: TimeSlot }[] },
  move: { pickup: { zone: string }; moveDate: string; timeSlot: TimeSlot },
): boolean {
  if (!mover.zones.includes(move.pickup.zone)) return false;
  return mover.availability.some(
    (day) => day.date === move.moveDate && slotCovers(day.slot, move.timeSlot),
  );
}

interface JobPosition {
  status: MoveStatus;
  progressStage: ProgressStage | null;
}

/**
 * The only moves a mover can make (spec 9.1 + M-06). "Loading" and "in transit"
 * are both the spec's IN_PROGRESS status, told apart by progressStage.
 */
export const JOB_TRANSITIONS: Record<
  JobAction,
  { from: JobPosition; to: JobPosition; label: string }
> = {
  EN_ROUTE: {
    from: { status: 'ASSIGNED', progressStage: null },
    to: { status: 'EN_ROUTE', progressStage: null },
    label: 'On the way to pickup',
  },
  LOADING: {
    from: { status: 'EN_ROUTE', progressStage: null },
    to: { status: 'IN_PROGRESS', progressStage: 'LOADING' },
    label: 'Loading',
  },
  IN_TRANSIT: {
    from: { status: 'IN_PROGRESS', progressStage: 'LOADING' },
    to: { status: 'IN_PROGRESS', progressStage: 'IN_TRANSIT' },
    label: 'In transit',
  },
  DELIVERED: {
    from: { status: 'IN_PROGRESS', progressStage: 'IN_TRANSIT' },
    to: { status: 'DELIVERED', progressStage: null },
    label: 'Delivered',
  },
};

export function nextJobAction(position: JobPosition): JobAction | null {
  const actions = Object.keys(JOB_TRANSITIONS) as JobAction[];
  return (
    actions.find((action) => {
      const { from } = JOB_TRANSITIONS[action];
      return from.status === position.status && from.progressStage === position.progressStage;
    }) ?? null
  );
}

/** Boxes are scanned at the pickup address, as they go into the vehicle. */
export function boxScanOpen(position: JobPosition): boolean {
  return position.status === 'IN_PROGRESS' && position.progressStage === 'LOADING';
}

/** Boxes and furniture the client listed, to compare with what the mover counted. */
export function expectedLoad(
  items: { name: string; quantity: number; category: string }[],
): { boxes: number; furniture: number } | null {
  if (items.length === 0) return null;
  const isBox = (item: { name: string; category: string }) =>
    /box|carton/i.test(`${item.category} ${item.name}`);
  const total = (list: { quantity: number }[]) =>
    list.reduce((sum, item) => sum + item.quantity, 0);
  return {
    boxes: total(items.filter(isBox)),
    furniture: total(items.filter((item) => !isBox(item))),
  };
}

/** TND has three decimals (millimes); rounding at that precision avoids float drift. */
export function roundMoney(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function computeEarning(gross: number, commissionRate: number) {
  const commission = roundMoney(gross * commissionRate);
  return {
    gross: roundMoney(gross),
    commissionRate,
    commission,
    net: roundMoney(gross - commission),
  };
}

const SIGNATURES: {
  contentType: string;
  extension: string;
  test: (bytes: Uint8Array) => boolean;
}[] = [
  {
    contentType: 'image/jpeg',
    extension: 'jpg',
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    contentType: 'image/png',
    extension: 'png',
    test: (b) =>
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => b[index] === value),
  },
  {
    contentType: 'image/webp',
    extension: 'webp',
    test: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP',
  },
  {
    contentType: 'application/pdf',
    extension: 'pdf',
    test: (b) => ascii(b, 0, 5) === '%PDF-',
  },
];

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

/** Identifies a file from its bytes; the client-supplied type and name are never trusted. */
export function sniffFile(bytes: Uint8Array): { contentType: string; extension: string } | null {
  const match = SIGNATURES.find((signature) => signature.test(bytes));
  return match ? { contentType: match.contentType, extension: match.extension } : null;
}
