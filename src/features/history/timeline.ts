// Turns a day of points into what a person did: where they stayed, and the trips between.
// Pure, so it can be tested without a phone.

export type HistoryPoint = { lat: number; lng: number; time: number; accuracyM: number | null };

export type Stay = { kind: 'stay'; from: number; to: number; lat: number; lng: number; points: number };
export type Trip = { kind: 'trip'; from: number; to: number; distanceM: number };
export type TimelineItem = Stay | Trip;

/** Points within this distance of a place's centre count as being there. */
const STAY_RADIUS_M = 150;
/** Shorter visits than this are part of a trip (a red light, a quick stop). */
const MIN_STAY_MS = 10 * 60_000;
/** Fixes rougher than this are left out of paths and distances. */
export const MAX_USABLE_ACCURACY_M = 500;
/**
 * Two stays this close, with only a short hop between, are one place split by rough
 * Wi-Fi/cell fixes (±100–200 m) rather than a real move.
 */
const SAME_PLACE_M = 300;
const MAX_HOP_MS = 15 * 60_000;

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** A point this far from both neighbours, while they agree with each other, is a glitch. */
const SPIKE_M = 1000;
const NEIGHBOURS_AGREE_M = 300;

/**
 * Points fit to draw and measure: rough fixes dropped, and spikes (a jump out and straight
 * back, e.g. an indoor GPS glitch) removed. Real trips don't come straight back.
 */
export function usable(points: HistoryPoint[]): HistoryPoint[] {
  const sorted = points
    .filter((p) => (p.accuracyM ?? 0) <= MAX_USABLE_ACCURACY_M)
    .sort((a, b) => a.time - b.time);

  // Repeat, since a spike can be several points long (each next to another spike point).
  let current = sorted;
  for (let pass = 0; pass < 3; pass++) {
    const kept = current.filter((p, i) => {
      const prev = current[i - 1];
      const next = current[i + 1];
      if (!prev || !next) return true;
      return !(
        distanceM(prev, p) > SPIKE_M &&
        distanceM(p, next) > SPIKE_M &&
        distanceM(prev, next) <= NEIGHBOURS_AGREE_M
      );
    });
    if (kept.length === current.length) break;
    current = kept;
  }
  return current;
}

function pathLength(points: HistoryPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceM(points[i - 1], points[i]);
  return total;
}

export function buildTimeline(input: HistoryPoint[]): TimelineItem[] {
  const points = usable(input);
  const items: TimelineItem[] = [];
  let cluster: HistoryPoint[] = [];
  let centre = { lat: 0, lng: 0 };
  // Points since the last stay ended, which make up the next trip.
  let travelled: HistoryPoint[] = [];

  const closeCluster = () => {
    if (cluster.length === 0) return;
    const from = cluster[0].time;
    const to = cluster[cluster.length - 1].time;
    if (to - from >= MIN_STAY_MS) {
      const last = items.at(-1);
      // The trip runs from leaving the previous place to arriving here.
      const tripPoints = [...travelled, cluster[0]];
      if (last && tripPoints.length > 1) {
        items.push({ kind: 'trip', from: last.to, to: from, distanceM: pathLength(tripPoints) });
      }
      items.push({ kind: 'stay', from, to, lat: centre.lat, lng: centre.lng, points: cluster.length });
      travelled = [cluster[cluster.length - 1]];
    } else {
      travelled.push(...cluster);
    }
    cluster = [];
  };

  for (const p of points) {
    if (cluster.length > 0 && distanceM(centre, p) <= STAY_RADIUS_M) {
      cluster.push(p);
      // Running average keeps the centre on where the person mostly was.
      centre = {
        lat: centre.lat + (p.lat - centre.lat) / cluster.length,
        lng: centre.lng + (p.lng - centre.lng) / cluster.length,
      };
      continue;
    }
    closeCluster();
    cluster = [p];
    centre = { lat: p.lat, lng: p.lng };
  }
  closeCluster();

  // Still on the move at the end of the data.
  const last = items.at(-1);
  if (last && travelled.length > 1 && travelled.at(-1)!.time > last.to) {
    items.push({ kind: 'trip', from: last.to, to: travelled.at(-1)!.time, distanceM: pathLength(travelled) });
  }
  return mergeSamePlace(items);
}

/** Joins stay → short hop → stay at (nearly) the same spot into one stay. */
function mergeSamePlace(items: TimelineItem[]): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const item of items) {
    const hop = out.at(-1);
    const before = out.at(-2);
    if (
      item.kind === 'stay' &&
      hop?.kind === 'trip' &&
      before?.kind === 'stay' &&
      hop.to - hop.from <= MAX_HOP_MS &&
      distanceM(before, item) <= SAME_PLACE_M
    ) {
      const points = before.points + item.points;
      out.splice(-2, 2, {
        kind: 'stay',
        from: before.from,
        to: item.to,
        // Weighted by points, so the longer part of the visit counts more.
        lat: (before.lat * before.points + item.lat * item.points) / points,
        lng: (before.lng * before.points + item.lng * item.points) / points,
        points,
      });
      continue;
    }
    out.push(item);
  }
  return out;
}

/** Distance travelled in the day: trips only, so GPS jitter while staying put doesn't count. */
export function travelledM(items: TimelineItem[]): number {
  return items.reduce((sum, item) => sum + (item.kind === 'trip' ? item.distanceM : 0), 0);
}
