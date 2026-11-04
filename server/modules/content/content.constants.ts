/**
 * Landing content registry — the single source of truth for public copy keys.
 * Defaults live here in code; DB overrides (per locale) win when present.
 */
export interface ContentKeyMeta {
  section: 'hero' | 'steps' | 'coverage';
  label: string;
  multiline?: boolean;
}

export const CONTENT_SECTIONS = ['hero', 'steps', 'coverage'] as const;
export type ContentSection = (typeof CONTENT_SECTIONS)[number];

export const CONTENT_KEYS: Record<string, ContentKeyMeta> = {
  'hero.titleLine1': { section: 'hero', label: 'Headline — line 1' },
  'hero.titleLine2': { section: 'hero', label: 'Headline — line 2 (accent)' },
  'hero.subtitle': { section: 'hero', label: 'Intro paragraph', multiline: true },
  'hero.primaryCta': { section: 'hero', label: 'Primary button label' },
  'hero.secondaryCta': { section: 'hero', label: 'Secondary link label' },
  'steps.step01.title': { section: 'steps', label: 'Step 1 — stage line' },
  'steps.step01.body': { section: 'steps', label: 'Step 1 — description', multiline: true },
  'steps.step02.title': { section: 'steps', label: 'Step 2 — stage line' },
  'steps.step02.body': { section: 'steps', label: 'Step 2 — description', multiline: true },
  'steps.step03.title': { section: 'steps', label: 'Step 3 — stage line' },
  'steps.step03.body': { section: 'steps', label: 'Step 3 — description', multiline: true },
  'steps.step04.title': { section: 'steps', label: 'Step 4 — stage line' },
  'steps.step04.body': { section: 'steps', label: 'Step 4 — description', multiline: true },
  'coverage.intro': { section: 'coverage', label: 'Coverage intro paragraph', multiline: true },
};

export const CONTENT_LOCALES = ['en', 'fr', 'ar'] as const;
export type ContentLocale = (typeof CONTENT_LOCALES)[number];

/** Freezes copy so a missing/failed DB read still renders the designed landing. */
export const CONTENT_DEFAULTS: Record<string, string> = {
  'hero.titleLine1': 'EVERY MOVE',
  'hero.titleLine2': 'ON THE RECORD.',
  'hero.subtitle':
    'One request. Vetted movers. A tracked timeline from quote to keys on the table. MoveUp lets you request a move in under five minutes and watch it happen — with a full record of every address, price and status change.',
  'hero.primaryCta': 'REQUEST A MOVE >>>',
  'hero.secondaryCta': 'SEE HOW IT WORKS',
  'steps.step01.title': 'REQUEST THE MOVE',
  'steps.step01.body':
    'Pickup, destination, floors, elevator, date. Five minutes, saved as a draft until you submit it.',
  'steps.step02.title': 'RECEIVE THE QUOTES',
  'steps.step02.body':
    'The society reviews the request and sends it to vetted movers in your zone with live vehicles.',
  'steps.step03.title': 'ACCEPT AND MEET YOUR MOVER',
  'steps.step03.body':
    'Compare price and rating, accept a quote, see the assigned crew profile, vehicle and reviews.',
  'steps.step04.title': 'FOLLOW IT TO THE LAST BOX',
  'steps.step04.body':
    'Track every status change, chat with the mover, sign off delivery, pay and rate the job.',
  'coverage.intro':
    'Six operating centers, city rates, no distance guesswork. The estimator prices by sector — surface, rooms, floors, elevator and address distance are all recorded per request.',
};

/** Minimal hero/step payloads the landing sections consume. */
export interface LandingCopy {
  hero: {
    titleLine1: string;
    titleLine2: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
  };
  steps: { title: string; body: string }[];
  coverageIntro: string;
}

export function buildLandingCopy(values: Record<string, string>): LandingCopy {
  const read = (key: string, fallback = ''): string =>
    values[key] ?? CONTENT_DEFAULTS[key] ?? fallback;

  return {
    hero: {
      titleLine1: read('hero.titleLine1'),
      titleLine2: read('hero.titleLine2'),
      subtitle: read('hero.subtitle'),
      primaryCta: read('hero.primaryCta'),
      secondaryCta: read('hero.secondaryCta'),
    },
    steps: ['01', '02', '03', '04'].map((step) => ({
      title: read(`steps.step${step}.title`, `STEP ${step}`),
      body: read(`steps.step${step}.body`),
    })),
    coverageIntro: read('coverage.intro'),
  };
}
