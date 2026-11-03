'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Custom hook from course ch.4 ("Custom Hook: useLocalStorage"), made production-safe:
 *  - JSON values (not only strings),
 *  - lazy read after mount (no SSR/hydration mismatch: localStorage doesn't exist on the server),
 *  - try/catch around storage (private mode / quota errors never crash the UI).
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // Corrupted or unavailable storage: keep the initial value.
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or blocked: the in-memory value still works.
    }
  }, [key, value, loaded]);

  const remove = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setValue(initialValue);
  }, [initialValue, key]);

  return [value, setValue, { loaded, remove }] as const;
}
