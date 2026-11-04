import * as SQLite from 'expo-sqlite';

import type { Database } from '@/lib/database.types';

// Points wait here until they reach Supabase, so nothing is lost without signal.
// Also holds small bits of tracker state that must survive the app being closed.

export type PendingPoint = Pick<
  Database['public']['Tables']['locations']['Insert'],
  'lat' | 'lng' | 'accuracy_m' | 'speed' | 'heading' | 'source' | 'battery_pct'
> & { recorded_at: string };

let opened: Promise<SQLite.SQLiteDatabase> | null = null;

function db() {
  opened ??= SQLite.openDatabaseAsync('tracker.db').then(async (database) => {
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS pending_points (recorded_at TEXT PRIMARY KEY, point TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    return database;
  });
  return opened;
}

export async function enqueue(point: PendingPoint) {
  const database = await db();
  await database.runAsync(
    'INSERT OR IGNORE INTO pending_points (recorded_at, point) VALUES (?, ?)',
    point.recorded_at,
    JSON.stringify(point),
  );
}

/** Oldest points first. */
export async function peek(limit: number): Promise<PendingPoint[]> {
  const database = await db();
  const rows = await database.getAllAsync<{ point: string }>(
    'SELECT point FROM pending_points ORDER BY recorded_at LIMIT ?',
    limit,
  );
  return rows.map((row) => JSON.parse(row.point) as PendingPoint);
}

export async function remove(recordedAt: string[]) {
  if (recordedAt.length === 0) return;
  const database = await db();
  const placeholders = recordedAt.map(() => '?').join(', ');
  await database.runAsync(`DELETE FROM pending_points WHERE recorded_at IN (${placeholders})`, ...recordedAt);
}

export async function pendingCount(): Promise<number> {
  const database = await db();
  const row = await database.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM pending_points');
  return row?.n ?? 0;
}

/** How many points are waiting to upload, and since when (the oldest one's time). */
export async function pendingSummary(): Promise<{ count: number; oldest: string | null }> {
  const database = await db();
  const row = await database.getFirstAsync<{ n: number; oldest: string | null }>(
    'SELECT COUNT(*) AS n, MIN(recorded_at) AS oldest FROM pending_points',
  );
  return { count: row?.n ?? 0, oldest: row?.oldest ?? null };
}

export async function getState<T>(key: string): Promise<T | null> {
  const database = await db();
  const row = await database.getFirstAsync<{ value: string }>('SELECT value FROM state WHERE key = ?', key);
  return row ? (JSON.parse(row.value) as T) : null;
}

export async function setState(key: string, value: unknown) {
  const database = await db();
  await database.runAsync(
    'INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    JSON.stringify(value),
  );
}

const LOG_SIZE = 100;

/**
 * Keeps the last 100 tracker events on the phone for diagnosing background behaviour
 * (read with: adb exec-out run-as com.sahebbeshra.gtrack cat files/SQLite/tracker.db).
 */
export async function logEvent(message: string) {
  const log = (await getState<string[]>('log')) ?? [];
  log.push(`${new Date().toISOString()} ${message}`);
  await setState('log', log.slice(-LOG_SIZE));
}

/** On sign-out: queued points belong to that account and must never upload as someone else. */
export async function clearAll() {
  const database = await db();
  await database.execAsync('DELETE FROM pending_points; DELETE FROM state;');
}
