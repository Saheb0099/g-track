import { useSyncExternalStore } from 'react';

/** A choice remembered on this phone only, that every screen using it follows as it changes. */
export function storedSetting<T extends string>(key: string, choices: readonly T[], fallback: T) {
  const listeners = new Set<() => void>();

  function get(): T {
    try {
      const value = localStorage.getItem(key) as T | null;
      return value && choices.includes(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function set(value: T) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Not remembered after a restart; still applies for now.
    }
    listeners.forEach((notify) => notify());
  }

  function subscribe(notify: () => void) {
    listeners.add(notify);
    return () => listeners.delete(notify);
  }

  function use(): T {
    return useSyncExternalStore(subscribe, get);
  }

  return { get, set, subscribe, use };
}
