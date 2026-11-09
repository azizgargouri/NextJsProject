/** Locale-aware formatters shared by the back office. `locale` is a BCP 47 tag. */
export type FormatLocale = 'en-GB' | 'fr-FR';

const cache = new Map<string, Intl.DateTimeFormat | Intl.RelativeTimeFormat | Intl.NumberFormat>();

function memo<T extends Intl.DateTimeFormat | Intl.RelativeTimeFormat | Intl.NumberFormat>(
  key: string,
  create: () => T,
): T {
  const existing = cache.get(key);
  if (existing) return existing as T;
  const created = create();
  cache.set(key, created);
  return created;
}

export function formatDateTime(iso: string, locale: FormatLocale = 'en-GB'): string {
  return memo(
    `dt:${locale}`,
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
  ).format(new Date(iso));
}

export function formatDateTimeSeconds(iso: string, locale: FormatLocale = 'en-GB'): string {
  return memo(
    `dts:${locale}`,
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }),
  ).format(new Date(iso));
}

export function formatDate(iso: string, locale: FormatLocale = 'en-GB'): string {
  return memo(`d:${locale}`, () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })).format(
    new Date(iso),
  );
}

/** "3 minutes ago" / "il y a 3 minutes"… falls back to a full date beyond 30 days. */
export function formatRelative(
  iso: string,
  locale: FormatLocale = 'en-GB',
  justNow = 'just now',
  now = Date.now(),
): string {
  const relative = memo(
    `r:${locale}`,
    () => new Intl.RelativeTimeFormat(locale.slice(0, 2), { numeric: 'auto' }),
  );
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return justNow;
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 30) return relative.format(Math.round(seconds / 86400), 'day');
  return formatDate(iso, locale);
}

/** Fixed three-decimal amounts (TND millimes). */
export function formatMoney(value: number, locale: FormatLocale = 'en-GB'): string {
  return memo(
    `m:${locale}`,
    () => new Intl.NumberFormat(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
  ).format(value);
}

export function formatBytes(bytes: number, locale: FormatLocale = 'en-GB'): string {
  const units = locale === 'fr-FR' ? ['o', 'Ko', 'Mo', 'Go', 'To'] : ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes < 1024) return `${bytes} ${units[0]}`;
  let value = bytes / 1024;
  let unit = 1;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const number = memo(
    `b:${locale}`,
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
  );
  return `${number.format(value >= 10 ? Math.round(value) : value)} ${units[unit]}`;
}

/** Coarse, honest device parts from a User-Agent string (no fingerprinting). */
export function parseUserAgent(userAgent: string | null): {
  browser: string | null;
  os: string | null;
} {
  if (!userAgent) return { browser: null, os: null };
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : /curl\//i.test(userAgent)
              ? 'curl'
              : null;
  const os = /iPhone|iPad/.test(userAgent)
    ? 'iOS'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Mac OS X|Macintosh/.test(userAgent)
        ? 'macOS'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;
  return { browser, os };
}
