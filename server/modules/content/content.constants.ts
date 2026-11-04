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

const EN_DEFAULTS: Record<string, string> = {
  'hero.titleLine1': 'EVERY MOVE',
  'hero.titleLine2': 'ON THE RECORD.',
  'hero.subtitle':
    'One request. Vetted movers. A tracked timeline from quote to keys on the table. Request a move in under five minutes and keep a full record of every address, price and status change.',
  'hero.primaryCta': 'REQUEST A MOVE >>>',
  'hero.secondaryCta': 'SEE HOW IT WORKS',
  'steps.step01.title': 'REQUEST THE MOVE',
  'steps.step01.body':
    'Pickup, destination, floors, elevator, date. Five minutes, saved as a draft until you submit it.',
  'steps.step02.title': 'RECEIVE THE QUOTES',
  'steps.step02.body':
    'MoveUp reviews the request and sends it to vetted movers who cover your city. Every quote arrives in writing.',
  'steps.step03.title': 'ACCEPT AND MEET YOUR MOVER',
  'steps.step03.body':
    'Compare the written quotes, accept one, and see the assigned crew, vehicle and reviews before the day.',
  'steps.step04.title': 'FOLLOW IT TO THE LAST BOX',
  'steps.step04.body':
    'Every status change is timestamped. Sign off the delivery, then pay and rate the job.',
  'coverage.intro':
    'Launching in three cities: Tunis, Sfax and Sousse. Every estimate is built from one published pricing rule, and the distance, volume and service level are recorded on the request.',
};

const FR_DEFAULTS: Record<string, string> = {
  'hero.titleLine1': 'DÉMÉNAGER,',
  'hero.titleLine2': 'NOIR SUR BLANC.',
  'hero.subtitle':
    "Une demande. Des déménageurs vérifiés. Un suivi complet, du devis jusqu'aux clés sur la table. Déposez votre demande en moins de cinq minutes et gardez la trace de chaque adresse, de chaque prix et de chaque changement de statut.",
  'hero.primaryCta': 'DEMANDER UN DEVIS >>>',
  'hero.secondaryCta': 'VOIR COMMENT ÇA MARCHE',
  'steps.step01.title': 'DÉCRIVEZ LE DÉMÉNAGEMENT',
  'steps.step01.body':
    "Départ, arrivée, étages, ascenseur, date. Cinq minutes, enregistré en brouillon jusqu'à l'envoi.",
  'steps.step02.title': 'RECEVEZ LES DEVIS',
  'steps.step02.body':
    'MoveUp vérifie la demande et la transmet aux déménageurs vérifiés de votre ville. Chaque devis arrive par écrit.',
  'steps.step03.title': 'ACCEPTEZ ET RENCONTREZ VOTRE ÉQUIPE',
  'steps.step03.body':
    "Comparez les devis écrits, acceptez-en un, et découvrez l'équipe, le véhicule et les avis avant le jour J.",
  'steps.step04.title': "SUIVEZ-LE JUSQU'AU DERNIER CARTON",
  'steps.step04.body':
    'Chaque changement de statut est horodaté. Validez la livraison, puis payez et notez la prestation.',
  'coverage.intro':
    'Lancement dans trois villes : Tunis, Sfax et Sousse. Chaque estimation suit une seule règle tarifaire publiée ; la distance, le volume et le niveau de service sont inscrits sur la demande.',
};

/**
 * Freezes copy per locale so a missing/failed DB read still renders the designed
 * landing. Arabic has no reviewed translation yet and falls back to English.
 */
export const CONTENT_DEFAULTS_BY_LOCALE: Record<ContentLocale, Record<string, string>> = {
  en: EN_DEFAULTS,
  fr: FR_DEFAULTS,
  ar: EN_DEFAULTS,
};

/** English defaults (kept for callers that predate per-locale defaults). */
export const CONTENT_DEFAULTS = EN_DEFAULTS;

export function contentDefaults(locale: string): Record<string, string> {
  return CONTENT_DEFAULTS_BY_LOCALE[locale as ContentLocale] ?? EN_DEFAULTS;
}

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

export function buildLandingCopy(
  values: Record<string, string>,
  locale: string = 'en',
): LandingCopy {
  const defaults = contentDefaults(locale);
  const read = (key: string, fallback = ''): string => values[key] ?? defaults[key] ?? fallback;

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
