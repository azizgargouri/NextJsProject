import { landingEn, fill, type LandingMessages } from './en';
import { landingFr } from './fr';

export type LandingLocale = 'en' | 'fr';
export const LANDING_LOCALES: LandingLocale[] = ['en', 'fr'];
/** Cookie the public language switch writes; read by the server landing page. */
export const LOCALE_COOKIE = 'moveup_locale';

export function toLandingLocale(value: string | null | undefined): LandingLocale {
  return value === 'fr' ? 'fr' : 'en';
}

export function landingMessages(locale: LandingLocale): LandingMessages {
  return locale === 'fr' ? landingFr : landingEn;
}

export { fill, type LandingMessages };
