// When a location reading becomes a saved point. Kept free of native imports so it's easy to test.

/**
 * How often the phone asks for a reading and how often a point is saved. Each group's admin
 * picks these (1 to 30 minutes); a phone in several groups follows the most frequent.
 */
export type Schedule = { checkEveryMs: number; saveEveryMs: number };

/** Used with no group yet, and the timing new groups start with. */
export const DEFAULT_SCHEDULE: Schedule = { checkEveryMs: 60_000, saveEveryMs: 5 * 60_000 };

/** The most frequent timing across your groups, as stored in the database (minutes). */
export function scheduleFor(groups: { check_every_min: number; save_every_min: number }[]): Schedule {
  if (groups.length === 0) return DEFAULT_SCHEDULE;
  return {
    checkEveryMs: Math.min(...groups.map((g) => g.check_every_min)) * 60_000,
    saveEveryMs: Math.min(...groups.map((g) => g.save_every_min)) * 60_000,
  };
}

/**
 * A point is due once this long has passed since the last saved one. Readings arrive about
 * once per check; the slack stops a gap a few seconds short from waiting a whole extra check.
 */
export function saveDueMs(schedule: Schedule): number {
  return schedule.saveEveryMs - Math.min(30_000, schedule.checkEveryMs / 2);
}

/** Also save after moving this far, so trips show as a path rather than far-apart dots. */
export const SAVE_AFTER_METERS = 250;

export type Fix = {
  lat: number;
  lng: number;
  time: number;
  accuracy?: number | null;
  /** Believed as part of a trip (see judgeFix), so the next rough jump needn't wait. */
  trip?: boolean;
};

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
/**
 * On a train or bus, fixes are often rough (a metal coach) and each lands a kilometre or more
 * further on, so none ever confirms the one before. A waiting fix is instead believed when the
 * next one, at least this much later, carries on away from the last good spot.
 */
const TRIP_STEP_MS = 30_000;
/** Once on a trip, rough jumps this soon after the last good fix are believed straight away. */
const TRIP_TRUST_MS = 10 * 60_000;

export type Verdict = 'accept' | 'reject' | 'hold';

export type Judgement = {
  verdict: Verdict;
  reason: string;
  /** Part of a trip; remembered with the fix. */
  trip?: boolean;
  /** The waiting (held) fix turned out to be the start of a trip: save it too. */
  keepHeld?: boolean;
};

/** Steady movement on from the waiting fix, at a believable speed and further from where it began. */
function movesOn(lastGood: Fix | null, held: Fix | null, next: Fix, acc: number): boolean {
  if (!lastGood || !held || next.time - held.time < TRIP_STEP_MS) return false;
  const heldAcc = held.accuracy ?? MAX_ACCURACY_M;
  const seconds = (next.time - held.time) / 1000;
  const reachable = distanceMeters(held, next) <= heldAcc + acc + MAX_SPEED_MS * seconds;
  // Further on by more than either fix's error: a glitch that jumps out and back fails this.
  const progress = distanceMeters(lastGood, next) - distanceMeters(lastGood, held);
  return reachable && progress > Math.max(heldAcc, acc);
}

/**
 * Judges a new fix against the last good one (and a held jump candidate, if any).
 * - accept: believable; save as usual.
 * - hold: a big jump from a shaky fix; remember it, and accept only if a later fix agrees.
 * - reject: rough, or physically impossible.
 */
export function judgeFix(lastGood: Fix | null, held: Fix | null, next: Fix): Judgement {
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
    if (confirmsHeld) return { verdict: 'accept', reason: 'first fix confirmed by a second fix' };
    if (movesOn(lastGood, held, next, acc)) {
      return { verdict: 'accept', reason: 'moving on from a waiting fix', trip: true, keepHeld: true };
    }
    return { verdict: 'hold', reason: `shaky first fix ±${Math.round(acc)} m` };
  }

  const dist = distanceMeters(lastGood, next);
  const seconds = Math.max(1, (next.time - lastGood.time) / 1000);
  const slack = (lastGood.accuracy ?? 0) + acc;
  if (dist > slack + MAX_SPEED_MS * seconds) {
    return { verdict: 'reject', reason: `impossible jump ${Math.round(dist)} m in ${Math.round(seconds)} s` };
  }

  if (dist > BIG_JUMP_M && acc > PRECISE_M) {
    if (lastGood.trip && next.time - lastGood.time <= TRIP_TRUST_MS) {
      return { verdict: 'accept', reason: 'trip continues', trip: true };
    }
    if (confirmsHeld) return { verdict: 'accept', reason: 'jump confirmed by a second fix' };
    if (movesOn(lastGood, held, next, acc)) {
      return { verdict: 'accept', reason: 'moving on from a waiting fix', trip: true, keepHeld: true };
    }
    return { verdict: 'hold', reason: `unconfirmed jump ${Math.round(dist)} m at ±${Math.round(acc)} m` };
  }
  // Still moving along: stay on the trip, so a faster stretch later doesn't have to wait.
  return { verdict: 'accept', reason: 'consistent', trip: !!lastGood.trip && dist >= SAVE_AFTER_METERS };
}

export function shouldSave(last: Fix | null, next: Fix, schedule: Schedule): boolean {
  if (!last) return true;
  if (next.time <= last.time) return false;
  if (next.time - last.time >= saveDueMs(schedule)) return true;
  // A fuzzy fix can look like movement; only count distance beyond the reading's own error.
  return distanceMeters(last, next) >= SAVE_AFTER_METERS + (next.accuracy ?? 0);
}
