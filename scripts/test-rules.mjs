#!/usr/bin/env node
// Feeds made-up journeys through the location rules (src/features/location/rules.ts) and checks
// which fixes are believed: trips with rough fixes should be kept, GPS glitches left out.
//
//   npm run test:rules

import { distanceMeters, judgeFix } from '../src/features/location/rules.ts';

const HOME = { lat: 22.5726, lng: 88.3639 };
const MIN = 60_000;

/** A point `km` kilometres east of `from` (good enough at these distances). */
function east(from, km) {
  return { lat: from.lat, lng: from.lng + km / (111.32 * Math.cos((from.lat * Math.PI) / 180)) };
}

/** Runs fixes through the rules the way the tracker does; returns the believed ones. */
function track(fixes) {
  let lastGood = null;
  let held = null;
  const believed = [];
  for (const fix of fixes) {
    const { verdict, trip, keepHeld } = judgeFix(lastGood, held, fix);
    if (verdict === 'hold') held = fix;
    if (verdict !== 'accept') continue;
    if (keepHeld && held) believed.push(held);
    believed.push(fix);
    lastGood = { ...fix, trip: !!trip };
    held = null;
  }
  return believed;
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
// Known limit, reported rather than checked: a glitch that drifts steadily away looks like a trip.
{
  const fixes = [];
  for (let t = 1; t <= 6; t++) fixes.push({ ...east(HOME, 1 + t * 0.8), time: t * MIN, accuracy: 250 });
  const far = track(fromHome(fixes)).filter((f) => distanceMeters(HOME, f) > 1000).length;
  console.log(`note   A glitch drifting steadily away is kept as a trip (${far} of ${fixes.length})`);
}

console.log(failed ? `\n${failed} failed.` : '\nAll rule checks passed.');
process.exit(failed ? 1 : 0);
