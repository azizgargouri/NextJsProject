/** Modules the seeder playground can fill, in the order they are seeded. */
export const PLAYGROUND_MODULES = [
  'accounts',
  'bookings',
  'mover',
  'smartRooms',
  'quality',
  'hr',
] as const;

export type PlaygroundModule = (typeof PLAYGROUND_MODULES)[number];

/** Every playground account uses this domain, so it can be found and removed. */
export const PLAYGROUND_DOMAIN = 'playground.moveup.tn';
export const PLAYGROUND_PASSWORD = 'Demo#2026!';

/** Markers on everything else the playground creates. */
export const PG = {
  movePrefix: 'MU-PG-',
  requestPrefix: 'MV-PG-',
  claimPrefix: 'CLM-PG-',
  homeLabel: '[Playground]',
  storagePrefix: 'playground/',
} as const;

/**
 * The playground writes fake data, so it is off in production unless
 * PLAYGROUND_ENABLED=true is set on purpose (e.g. a demo deployment).
 */
export function playgroundEnabled(): boolean {
  return process.env.PLAYGROUND_ENABLED === 'true' || process.env.NODE_ENV !== 'production';
}
