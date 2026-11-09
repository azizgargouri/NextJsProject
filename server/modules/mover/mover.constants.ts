/** Operating centres, matching the landing page coverage section. */
export const SERVICE_ZONES = [
  { code: 'TUN', label: 'Tunis' },
  { code: 'SFA', label: 'Sfax' },
  { code: 'SOU', label: 'Sousse' },
  { code: 'BIZ', label: 'Bizerte' },
  { code: 'NAB', label: 'Nabeul' },
  { code: 'KAI', label: 'Kairouan' },
] as const;
export const ZONE_CODES = SERVICE_ZONES.map((zone) => zone.code) as [string, ...string[]];

export const DOCUMENT_WARNING_DAYS = 30;
export const AUTO_COMPLETE_HOURS = 48;
export const QUOTE_VALID_HOURS = 48;
/** Used until an active pricing rule carries a rate. Needs business confirmation. */
export const DEFAULT_COMMISSION_RATE = 0.15;

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_PHOTOS_PER_STAGE = 20;
/** Several angles, so everything loaded can be seen and counted later. */
export const MIN_LOAD_PHOTOS = 4;
export const MIN_DELIVERY_PHOTOS = 1;
export const FILE_URL_TTL_SECONDS = 15 * 60;

/** Statuses during which the mover may see the client's address and phone. */
export const CONTACT_VISIBLE_STATUSES = [
  'ASSIGNED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'DELIVERED',
  'DISPUTED',
] as const;
export const ACTIVE_JOB_STATUSES = ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'] as const;
/** Chat stays open while the move is live; ended moves are read-only. */
export const CHAT_OPEN_STATUSES = CONTACT_VISIBLE_STATUSES;
