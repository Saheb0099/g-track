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

// --- Sanity checks: is a fix believable? ---------------------------------------------------
// Indoors, GPS can report a confident-looking fix kilometres off (signals bouncing off walls).
// These rules keep such fixes out, while letting real movement through at once.

/** Fixes rougher than this are never used. */
export const MAX_ACCURACY_M = 300;
/** Faster than this between two fixes is not real movement (180 km/h). */
const MAX_SPEED_MS = 50;
/** A jump this far needs a precise fix, or confirmation, to be believed. */
const BIG_JUMP_M = 1000;
/** A fix at least this precise is believed even after a big jump (outdoor GPS is ~5–20 m). */
const PRECISE_M = 50;
/** A held jump is confirmed by a fix at least this precise, at least this long after it. */
const CONFIRM_ACCURACY_M = 100;
const CONFIRM_AFTER_MS = 2 * 60_000;
/** After this long without a good fix, the last good one no longer vouches for anything. */
const GOOD_FIX_TRUST_MS = 30 * 60_000;

export type Verdict = 'accept' | 'reject' | 'hold';

/**
 * Judges a new fix against the last good one (and a held jump candidate, if any).
 * - accept: believable; save as usual.
 * - hold: a big jump from a shaky fix; remember it, and accept only if a later fix agrees.
 * - reject: rough, or physically impossible.
 */
export function judgeFix(lastGood: Fix | null, held: Fix | null, next: Fix): { verdict: Verdict; reason: string } {
  const acc = next.accuracy ?? MAX_ACCURACY_M;
  if (acc > MAX_ACCURACY_M) return { verdict: 'reject', reason: `rough fix ±${Math.round(acc)} m` };

  // A later, reasonably precise fix agreeing with the held one confirms it. Indoor glitches tend
  // to be rougher and short-lived; a real arrival keeps giving the same place.
  const confirmsHeld =
    !!held &&
    acc <= CONFIRM_ACCURACY_M &&
    next.time - held.time >= CONFIRM_AFTER_MS &&
    distanceMeters(held, next) <= (held.accuracy ?? 0) + acc + 200;

  // Nothing recent to compare with (new install, sign-in, a long gap): start from a precise fix.
  if (!lastGood || next.time - lastGood.time > GOOD_FIX_TRUST_MS) {
    if (acc <= PRECISE_M) return { verdict: 'accept', reason: 'precise first fix' };
    return confirmsHeld
      ? { verdict: 'accept', reason: 'first fix confirmed by a second fix' }
      : { verdict: 'hold', reason: `shaky first fix ±${Math.round(acc)} m` };
  }

  const dist = distanceMeters(lastGood, next);
  const seconds = Math.max(1, (next.time - lastGood.time) / 1000);
  const slack = (lastGood.accuracy ?? 0) + acc;
  if (dist > slack + MAX_SPEED_MS * seconds) {
    return { verdict: 'reject', reason: `impossible jump ${Math.round(dist)} m in ${Math.round(seconds)} s` };
  }

  if (dist > BIG_JUMP_M && acc > PRECISE_M) {
    return confirmsHeld
      ? { verdict: 'accept', reason: 'jump confirmed by a second fix' }
      : { verdict: 'hold', reason: `unconfirmed jump ${Math.round(dist)} m at ±${Math.round(acc)} m` };
  }
  return { verdict: 'accept', reason: 'consistent' };
}

export function shouldSave(last: Fix | null, next: Fix): boolean {
  if (!last) return true;
  if (next.time <= last.time) return false;
  if (next.time - last.time >= SAVE_DUE_MS) return true;
  // A fuzzy fix can look like movement; only count distance beyond the reading's own error.
  return distanceMeters(last, next) >= SAVE_AFTER_METERS + (next.accuracy ?? 0);
}
