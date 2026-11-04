import { useSyncExternalStore } from 'react';

import type { GroupSummary } from '@/features/groups/api';

// The map opens on the group you looked at last. Remembered on this phone only.
const KEY = 'gtrack.current-group';
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setCurrentGroup(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Not remembered; the map falls back to the first group.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** The remembered group if you're still in it, else your first group, else null. */
export function useCurrentGroup(groups: GroupSummary[] | undefined): GroupSummary | null {
  const stored = useSyncExternalStore(subscribe, read);
  if (!groups || groups.length === 0) return null;
  return groups.find((g) => g.id === stored) ?? groups[0];
}
