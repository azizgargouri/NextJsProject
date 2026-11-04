'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatDateTimeSeconds,
  formatMoney,
  formatRelative,
  parseUserAgent,
  type FormatLocale,
} from '@/lib/format';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { en, type AdminMessages } from './en';
import { fr } from './fr';

export type AdminLocale = 'en' | 'fr';

export const ADMIN_LOCALES: AdminLocale[] = ['en', 'fr'];

const DICTIONARIES: Record<AdminLocale, AdminMessages> = { en, fr };
const FORMAT_LOCALES: Record<AdminLocale, FormatLocale> = { en: 'en-GB', fr: 'fr-FR' };

/** Any stored locale outside the back-office set (e.g. `ar`) falls back to English. */
export function toAdminLocale(locale: string | null | undefined): AdminLocale {
  return locale === 'fr' ? 'fr' : 'en';
}

interface AdminI18nValue {
  locale: AdminLocale;
  m: AdminMessages;
  setLocale: (locale: AdminLocale) => void;
  fmt: {
    date: (iso: string) => string;
    dateTime: (iso: string) => string;
    dateTimeSeconds: (iso: string) => string;
    relative: (iso: string) => string;
    money: (value: number) => string;
    bytes: (bytes: number) => string;
    device: (userAgent: string | null) => string;
  };
}

const AdminI18nContext = createContext<AdminI18nValue | null>(null);

/**
 * Back-office language. The source of truth is the signed-in user's `locale`
 * (persisted server-side), so the choice follows the account across devices.
 */
export function AdminI18nProvider({ children }: { children: ReactNode }) {
  const storedLocale = useAuthStore((state) => state.user?.locale);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const queryClient = useQueryClient();
  const locale = toAdminLocale(storedLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    (next: AdminLocale) => {
      const previous = useAuthStore.getState().user?.locale ?? 'en';
      if (toAdminLocale(previous) === next) return;
      updateProfile({ locale: next });
      api.account
        .updateProfile({ locale: next })
        .then((user) => {
          queryClient.setQueryData(['account', 'profile'], user);
          void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        })
        .catch(() => {
          updateProfile({ locale: previous });
          toast.error(DICTIONARIES[toAdminLocale(previous)].shell.language.saveFailed);
        });
    },
    [queryClient, updateProfile],
  );

  const value = useMemo<AdminI18nValue>(() => {
    const m = DICTIONARIES[locale];
    const tag = FORMAT_LOCALES[locale];
    return {
      locale,
      m,
      setLocale,
      fmt: {
        date: (iso) => formatDate(iso, tag),
        dateTime: (iso) => formatDateTime(iso, tag),
        dateTimeSeconds: (iso) => formatDateTimeSeconds(iso, tag),
        relative: (iso) => formatRelative(iso, tag, m.time.justNow),
        money: (amount) => formatMoney(amount, tag),
        bytes: (size) => formatBytes(size, tag),
        device: (userAgent) => {
          const { browser, os } = parseUserAgent(userAgent);
          if (browser && os) return m.settings.deviceOn(browser, os);
          return browser ?? os ?? m.settings.unknownDevice;
        },
      },
    };
  }, [locale, setLocale]);

  return <AdminI18nContext.Provider value={value}>{children}</AdminI18nContext.Provider>;
}

export function useAdminI18n(): AdminI18nValue {
  const context = useContext(AdminI18nContext);
  if (!context) throw new Error('useAdminI18n must be used inside AdminI18nProvider');
  return context;
}

export type { AdminMessages };
