import type { LngLat, LngLatBounds } from '@maplibre/maplibre-react-native';

/** A circle of `radiusM` metres around a point, as a GeoJSON polygon (for accuracy rings). */
export function circlePolygon(center: LngLat, radiusM: number, steps = 48): GeoJSON.Polygon {
  const [lng, lat] = center;
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  const ring: GeoJSON.Position[] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

/** Bounds around all points, padded so a single point still gets a sensible street-level view. */
export function boundsAround(points: LngLat[], minSpanDeg = 0.01): LngLatBounds | null {
  if (points.length === 0) return null;
  let [west, south] = points[0];
  let [east, north] = points[0];
  for (const [lng, lat] of points) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  const padLng = Math.max(0, (minSpanDeg - (east - west)) / 2);
  const padLat = Math.max(0, (minSpanDeg - (north - south)) / 2);
  return [west - padLng, south - padLat, east + padLng, north + padLat];
}
