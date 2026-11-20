#!/usr/bin/env node
// Feeds made-up journeys through the location rules (src/features/location/rules.ts) and checks
// which fixes are believed: trips with rough fixes should be kept, GPS glitches left out.
//
//   npm run test:rules

import { distanceMeters, judgeFix, nextHeld, shouldSave } from '../src/features/location/rules.ts';

const HOME = { lat: 22.5726, lng: 88.3639 };
const MIN = 60_000;

/** A point `km` kilometres east of `from` (good enough at these distances). */
function east(from, km) {
  return { lat: from.lat, lng: from.lng + km / (111.32 * Math.cos((from.lat * Math.PI) / 180)) };
}

/** Runs fixes through the rules the way the tracker does; returns the believed ones. */
function track(fixes, checkEveryMs = MIN) {
  let lastGood = null;
  let held = null;
  const believed = [];
  for (const fix of fixes) {
    const { verdict, trip, keepHeld } = judgeFix(lastGood, held, fix, checkEveryMs);
    if (verdict === 'hold') held = nextHeld(held, fix, checkEveryMs);
    if (verdict !== 'accept') continue;
    if (keepHeld && held) believed.push(held);
    believed.push(fix);
    lastGood = { ...fix, trip: !!trip };
    held = null;
  }
  return believed;
}

/** Runs fixes through the tracker's steps (believe, then save); returns saved points. */
function saves(fixes, schedule = { checkEveryMs: MIN, saveEveryMs: 5 * MIN }) {
  let lastGood = null;
  let held = null;
  let lastSaved = null;
  const saved = [];
  for (const raw of fixes) {
    const { verdict, trip } = judgeFix(lastGood, held, raw, schedule.checkEveryMs);
    if (verdict === 'hold') held = nextHeld(held, raw, schedule.checkEveryMs);
    if (verdict !== 'accept') continue;
    const fix = raw;
    const previous = lastGood;
    lastGood = { ...fix, trip: !!trip };
    held = null;
    if (shouldSave(lastSaved, fix, schedule, previous)) {
      saved.push(fix);
      lastSaved = fix;
    }
  }
  return saved;
}

/** Sitting at home with a precise fix, then `fixes`. */
function fromHome(fixes) {
  return [{ ...HOME, time: 0, accuracy: 15 }, ...fixes];
}

/** A straight trip east at `kmh`, a fix every `everyMin` minutes for `minutes`, all at ±`acc` m. */
function trip(kmh, acc, minutes, everyMin = 1) {
  const fixes = [];
  for (let t = everyMin; t <= minutes; t += everyMin) {
    fixes.push({ ...east(HOME, (kmh * t) / 60), time: t * MIN, accuracy: acc });
  }
  return fixes;
}

let failed = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'ok    ' : 'FAIL  '} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failed++;
}

// Trips: rough fixes inside a coach should still make a route.
for (const [name, kmh, acc] of [
  ['Train at 60 km/h, ±150 m fixes', 60, 150],
  ['Express train at 130 km/h, ±200 m fixes', 130, 200],
  ['Bus at 40 km/h, ±120 m fixes', 40, 120],
]) {
  const fixes = trip(kmh, acc, 30);
  const kept = track(fromHome(fixes)).length - 1;
  check(name, kept >= fixes.length - 1, `${kept} of ${fixes.length} fixes kept`);
}
{
  const fixes = trip(60, 150, 30, 5);
  const kept = track(fromHome(fixes)).length - 1;
  check('Train with a fix every 5 min', kept >= fixes.length - 1, `${kept} of ${fixes.length} kept`);
}
{
  const fixes = trip(60, 20, 30);
  const kept = track(fromHome(fixes)).length - 1;
  check('Train with precise GPS (unchanged)', kept === fixes.length, `${kept} of ${fixes.length} kept`);
}

// Glitches: these must stay out.
{
  // The glitch seen on 4 Nov: one fix 7.6 km away, then back home.
  const kept = track(
    fromHome([
      { ...east(HOME, 7.6), time: 6 * MIN, accuracy: 150 },
      { ...HOME, time: 7 * MIN, accuracy: 30 },
      { ...HOME, time: 8 * MIN, accuracy: 30 },
    ]),
  );
  const far = kept.filter((f) => distanceMeters(HOME, f) > 1000).length;
  check('Glitch 7.6 km away and straight back', far === 0, `${far} far fixes kept`);
}
{
  // Jumping back and forth between two wrong places.
  const fixes = [];
  for (let t = 1; t <= 10; t++) fixes.push({ ...east(HOME, t % 2 ? 3 : -3), time: t * MIN, accuracy: 200 });
  const kept = track(fromHome(fixes));
  const far = kept.filter((f) => distanceMeters(HOME, f) > 1000).length;
  check('Glitch hopping between two wrong places', far === 0, `${far} far fixes kept`);
}
// The phone's clock set back an hour: readings after that must still be believed and saved.
{
  const lastGood = { ...HOME, time: 60 * MIN, accuracy: 15 };
  const next = { ...east(HOME, 0.3), time: 2 * MIN, accuracy: 15 };
  const { verdict } = judgeFix(lastGood, null, next);
  const saves = shouldSave(lastGood, next, { checkEveryMs: MIN, saveEveryMs: 5 * MIN });
  check('Clock set back an hour: the next reading is kept', verdict === 'accept' && saves, `${verdict}, save=${saves}`);
}
{
  // Readings a few seconds out of order are not a clock change.
  const last = { ...HOME, time: 10 * MIN, accuracy: 15 };
  const saves = shouldSave(
    last,
    { ...HOME, time: 10 * MIN - 5000, accuracy: 15 },
    { checkEveryMs: MIN, saveEveryMs: 5 * MIN },
  );
  check('A reading 5 s older than the last is still skipped', !saves);
}

// Indoors after a long gap (a pause, a restart): rough Wi-Fi/cell fixes may be all there is.
{
  // ±200 m every minute, jittering a little around one spot, with no recent good fix.
  const fixes = [];
  for (let t = 0; t <= 10; t++) fixes.push({ ...east(HOME, ((t % 3) - 1) * 0.05), time: t * MIN, accuracy: 200 });
  const kept = track(fixes);
  const firstAt = kept.length ? kept[0].time / MIN : null;
  check(
    'Indoors after a gap, ±200 m fixes every minute',
    kept.length >= 8 && firstAt !== null && firstAt <= 3,
    `${kept.length} of ${fixes.length} kept, first at minute ${firstAt}`,
  );
}
{
  // Rough fixes that never agree (hopping 2 km between towers) are still not believed.
  const fixes = [];
  for (let t = 0; t <= 10; t++) fixes.push({ ...east(HOME, t % 2 ? 2 : 0), time: t * MIN, accuracy: 200 });
  check('Rough fixes that keep disagreeing after a gap', track(fixes).length === 0, `${track(fixes).length} kept`);
}
{
  // A rough glitch far away for a minute, then rough fixes at home: home is believed, not the glitch.
  const fixes = [
    { ...east(HOME, 5), time: 0, accuracy: 200 },
    ...Array.from({ length: 6 }, (_, i) => ({ ...HOME, time: (i + 1) * MIN, accuracy: 200 })),
  ];
  const kept = track(fixes);
  const far = kept.filter((f) => distanceMeters(HOME, f) > 1000).length;
  check(
    'A rough glitch, then rough fixes at home, after a gap',
    kept.length > 0 && far === 0,
    `${kept.length} kept, ${far} far`,
  );
}

// Tower fixes (±200 m, hopping as the phone switches towers) shouldn't be saved as moving.
{
  // What happened on 20 Nov: tower fixes at home, then one confident ±6 m GPS glitch 350 m away.
  // The next tower fixes must win again, not the glitch.
  const fixes = [0, 1, 2].map((t) => ({ ...HOME, time: t * MIN, accuracy: 200 }));
  fixes.push({ ...east(HOME, 0.35), time: 3 * MIN, accuracy: 6 });
  for (let t = 4; t <= 20; t++) fixes.push({ ...HOME, time: t * MIN, accuracy: 200 });
  const after = saves(fixes).filter((f) => f.time > 10 * MIN);
  const atGlitch = after.filter((f) => distanceMeters(HOME, f) > 250).length;
  check(
    'A confident GPS glitch indoors does not stick',
    after.length > 0 && atGlitch === 0,
    `${atGlitch} of ${after.length} later points at the glitch`,
  );
}
{
  // No GPS at all: settled on one tower, then hopping to another 600 m away every other minute.
  const fixes = [0, 1, 2].map((t) => ({ ...HOME, time: t * MIN, accuracy: 200 }));
  for (let t = 3; t <= 32; t++) fixes.push({ ...east(HOME, t % 2 ? 0.6 : 0), time: t * MIN, accuracy: 200 });
  const saved = saves(fixes);
  check(
    'Hopping between towers is not saved as moving',
    saved.length >= 5 && saved.length <= 8,
    `${saved.length} saved in 30 min, a point is due every 5`,
  );
}
{
  // Readings in pairs seconds apart (as the phone sends them), hopping for a minute at a time.
  const fixes = [0, 1, 2].map((t) => ({ ...HOME, time: t * MIN, accuracy: 200 }));
  for (let t = 3; t <= 32; t++) {
    const spot = east(HOME, t % 2 ? 0.6 : 0);
    fixes.push({ ...spot, time: t * MIN, accuracy: 200 }, { ...spot, time: t * MIN + 5000, accuracy: 200 });
  }
  const saved = saves(fixes);
  check('Paired readings on a hop are not saved as moving', saved.length <= 8, `${saved.length} saved in 30 min`);
}
{
  // A bus with rough fixes is still a route: a point at least every 2 minutes.
  const fixes = trip(40, 150, 30);
  const saved = saves(fromHome(fixes)).length - 1;
  check('Bus with ±150 m fixes still saves a route', saved >= 14, `${saved} points in 30 min`);
}
{
  // Precise GPS on the move saves as before: every 250 m.
  const saved = saves(fromHome(trip(30, 15, 20))).length - 1;
  check('Driving with GPS saves as before', saved >= 19, `${saved} points in 20 min`);
}

// Groups that check less often (the admin picks 1 to 30 minutes): readings arrive that far apart,
// give or take a minute, and the rules must not expire between two of them.
/** Times every `every` minutes for `hours`, a little early or late as Android delivers them. */
function everyFew(every, hours) {
  const times = [];
  for (let i = 0, t = 0; t <= hours * 60; i++, t += every + [0.7, 1, -0.5][i % 3]) times.push(t * MIN);
  return times;
}
for (const every of [15, 30]) {
  const times = everyFew(every, 3);
  const train = times.map((time, i) =>
    i === 0 ? { ...HOME, time, accuracy: 15 } : { ...east(HOME, time / MIN), time, accuracy: 150 },
  );
  const kept = track(train, every * MIN).length;
  check(`Train with ±150 m readings every ${every} min`, kept >= train.length - 1, `${kept} of ${train.length} kept`);

  const indoors = times.map((time) => ({ ...HOME, time, accuracy: 200 }));
  const believed = track(indoors, every * MIN).length;
  check(
    `Indoors, ±200 m readings every ${every} min`,
    believed >= indoors.length - 1,
    `${believed} of ${indoors.length} kept`,
  );
}

{
  // Longer trust must not make glitches easier to believe: hopping between two wrong places 3 km
  // either side, with readings every 30 minutes.
  const times = everyFew(30, 4);
  const fixes = times.map((time, i) =>
    i === 0 ? { ...HOME, time, accuracy: 15 } : { ...east(HOME, i % 2 ? 3 : -3), time, accuracy: 200 },
  );
  const far = track(fixes, 30 * MIN).filter((f) => distanceMeters(HOME, f) > 1000).length;
  check('Glitch hopping between two wrong places, readings every 30 min', far === 0, `${far} far fixes kept`);
}

// Known limit, reported rather than checked: a glitch that drifts steadily away looks like a trip.
{
  const fixes = [];
  for (let t = 1; t <= 6; t++) fixes.push({ ...east(HOME, 1 + t * 0.8), time: t * MIN, accuracy: 250 });
  const far = track(fromHome(fixes)).filter((f) => distanceMeters(HOME, f) > 1000).length;
  console.log(`note   A glitch drifting steadily away is kept as a trip (${far} of ${fixes.length})`);
}

console.log(failed ? `\n${failed} failed.` : '\nAll rule checks passed.');
process.exit(failed ? 1 : 0);
