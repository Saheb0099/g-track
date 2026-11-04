// When a location reading becomes a saved point. Kept free of native imports so it's easy to test.

/** Save at least this often while sitting still. */
export const SAVE_EVERY_MS = 5 * 60_000;
/** Readings arrive about once a minute; this slack stops a 4:59 gap from waiting a whole extra minute. */
const SAVE_EVERY_SLACK_MS = 30_000;
/** A point is due once this long has passed since the last saved one. */
export const SAVE_DUE_MS = SAVE_EVERY_MS - SAVE_EVERY_SLACK_MS;
/** Also save after moving this far, so trips show as a path rather than dots 5 minutes apart. */
export const SAVE_AFTER_METERS = 250;

export type Fix = { lat: number; lng: number; time: number; accuracy?: number | null };

export function distanceMeters(a: Fix, b: Fix): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function shouldSave(last: Fix | null, next: Fix): boolean {
  if (!last) return true;
  if (next.time <= last.time) return false;
  if (next.time - last.time >= SAVE_DUE_MS) return true;
  // A fuzzy fix can look like movement; only count distance beyond the reading's own error.
  return distanceMeters(last, next) >= SAVE_AFTER_METERS + (next.accuracy ?? 0);
}
