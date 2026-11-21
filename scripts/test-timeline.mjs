#!/usr/bin/env node
// Feeds made-up days through the history timeline (src/features/history/timeline.ts) and checks
// the places and distance it finds. Rough readings wobble at random, so those days are run many
// times with different wobbles and judged on the typical result.
//
//   npm run test:timeline

import { buildTimeline, travelledM } from '../src/features/history/timeline.ts';

// A made-up spot; only distances from it matter.
const BASE = { lat: 20, lng: 80 };
const M_LAT = 111_320;
const M_LNG = 111_320 * Math.cos((BASE.lat * Math.PI) / 180);
const MIN = 60_000;
const RUNS = 100;

let seed = 1;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** A reading near (x, y) metres from BASE: off by up to ~1.2× its accuracy, in any direction. */
function reading(x, y, time, accuracyM) {
  const off = accuracyM * 1.2 * Math.sqrt(random());
  const angle = random() * 2 * Math.PI;
  return {
    lat: BASE.lat + (y + off * Math.sin(angle)) / M_LAT,
    lng: BASE.lng + (x + off * Math.cos(angle)) / M_LNG,
    time,
    accuracyM,
  };
}
/** Indoor Wi-Fi and tower readings. */
const rough = () => [100, 150, 200, 250][Math.floor(random() * 4)];
const gps = () => 10;

/** Staying at (x, y) from `start` for `minutes`, a reading every `every` minutes. */
function stay(x, y, start, minutes, every, accuracy) {
  const out = [];
  for (let m = 0; m <= minutes; m += every) out.push(reading(x, y, start + m * MIN, accuracy()));
  return out;
}
/** Going in a straight line from (x0, y0) to (x1, y1), readings on the way. */
function go(x0, y0, x1, y1, start, minutes, every, accuracy) {
  const out = [];
  for (let m = every; m < minutes; m += every) {
    const f = m / minutes;
    out.push(reading(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, start + m * MIN, accuracy()));
  }
  return out;
}

/** Runs a made-up day many times; returns the typical distance (km) and how often each place count came up. */
function runs(makeDay) {
  const km = [];
  const places = {};
  for (let run = 0; run < RUNS; run++) {
    seed = 1000 + run * 7919;
    const items = buildTimeline(makeDay());
    km.push(travelledM(items) / 1000);
    const n = items.filter((i) => i.kind === 'stay').length;
    places[n] = (places[n] ?? 0) + 1;
  }
  km.sort((a, b) => a - b);
  return { km: km[Math.floor(RUNS / 2)], places, share: (n) => (places[n] ?? 0) / RUNS };
}

let failed = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'ok    ' : 'FAIL  '} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failed++;
}
const describe = (r) =>
  `typically ${r.km.toFixed(1)} km; places ${Object.entries(r.places)
    .map(([n, c]) => `${n}: ${c}%`)
    .join(', ')}`;

// Staying put.
{
  // Seen on 21 Nov: a phone on a desk for two hours showed "Moved 11 km".
  const r = runs(() => stay(0, 0, 0, 130, 5, rough));
  check('Phone lying still, rough readings: hardly any distance', r.km < 1, describe(r));
  check('Phone lying still, rough readings: mostly one place', r.share(1) >= 0.6, describe(r));
}
{
  const r = runs(() => stay(0, 0, 0, 130, 5, gps));
  check('Phone lying still, GPS: one place, no distance', r.km === 0 && r.share(1) === 1, describe(r));
}
{
  // One stray reading 400 m off in the middle of a GPS stay.
  const day = stay(0, 0, 0, 120, 5, gps);
  day[12] = { ...reading(400, 0, day[12].time, 250) };
  const items = buildTimeline(day);
  const stays = items.filter((i) => i.kind === 'stay');
  check(
    'One stray reading does not split a stay',
    stays.length === 1 && travelledM(items) === 0,
    `${stays.length} place(s), ${Math.round(travelledM(items))} m`,
  );
}

// Real trips.
{
  const r = runs(() => [
    ...stay(0, 0, 0, 60, 5, gps),
    ...go(0, 0, 3000, 0, 60 * MIN, 45, 5, gps),
    ...stay(3000, 0, 105 * MIN, 60, 5, gps),
  ]);
  check('Walk 3 km with GPS: two places, about 3 km', r.share(2) === 1 && Math.abs(r.km - 3) < 0.15, describe(r));
}
{
  const r = runs(() => [
    ...stay(0, 0, 0, 60, 5, rough),
    ...go(0, 0, 15000, 0, 60 * MIN, 40, 5, () => 300),
    ...stay(15000, 0, 100 * MIN, 60, 5, rough),
  ]);
  check('Bus 15 km with tower readings: about 15 km', r.km > 13.5 && r.km < 17.5, describe(r));
  check('Bus 15 km with tower readings: mostly two places', r.share(2) >= 0.8, describe(r));
}
{
  const r = runs(() => [
    ...stay(0, 0, 0, 30, 5, () => 200),
    ...go(0, 0, 2000, 0, 30 * MIN, 30, 5, () => 200),
    ...stay(2000, 0, 60 * MIN, 30, 5, () => 200),
  ]);
  check('Walk 2 km with rough readings: the trip is kept', r.km > 1.5 && r.km < 3.5, describe(r));
  check('Walk 2 km with rough readings: mostly two places', r.share(2) >= 0.7, describe(r));
}
{
  const r = runs(() => [
    ...stay(0, 0, 0, 60, 5, rough),
    ...go(0, 0, 400, 0, 60 * MIN, 6, 3, rough),
    ...stay(400, 0, 66 * MIN, 60, 5, rough),
  ]);
  check('Two places 400 m apart, rough readings: mostly told apart', r.share(2) >= 0.7, describe(r));
}
{
  // A slow walk with a reading every minute (group timing set to 1 min): readings close together
  // must not drag the place along and turn the walk into one long stay.
  const r = runs(() => [
    ...stay(0, 0, 0, 30, 1, gps),
    ...go(0, 0, 1000, 0, 30 * MIN, 30, 1, gps),
    ...stay(1000, 0, 60 * MIN, 30, 1, gps),
  ]);
  check('Slow 1 km walk, a reading every minute: the walk is kept', r.km > 0.7 && r.share(2) === 1, describe(r));
}
{
  // Leaving is noticed at the first reading away, not one reading late.
  const day = [...stay(0, 0, 0, 60, 5, gps), ...go(0, 0, 3000, 0, 60 * MIN, 45, 5, gps)];
  const items = buildTimeline(day);
  const home = items[0];
  const trip = items[1];
  check(
    'A trip starts when they leave',
    home?.kind === 'stay' && trip?.kind === 'trip' && trip.from === home.to && home.to === 60 * MIN,
    `stay until ${home ? home.to / MIN : '?'} min, trip from ${trip ? trip.from / MIN : '?'} min`,
  );
}

// Known limits, reported rather than checked.
{
  const r = runs(() => [
    ...stay(0, 0, 0, 60, 5, rough),
    ...go(0, 0, 250, 0, 60 * MIN, 6, 3, rough),
    ...stay(250, 0, 66 * MIN, 60, 5, rough),
  ]);
  console.log(`note   Places under ~300 m apart with rough readings are often one place (${describe(r)})`);
}

console.log(failed ? `\n${failed} failed.` : '\nAll timeline checks passed.');
process.exit(failed ? 1 : 0);
