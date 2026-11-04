import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { useColorScheme } from 'react-native';

import { storedSetting } from '@/lib/stored-setting';

// Every map here is free and needs no key or account. The OpenStreetMap website also offers
// Cycle Map, Transport Map and Tracestrack, but those need a signed-up API key, so they're left out.

const OSM = '© OpenStreetMap contributors';

/** A map made of ready-drawn picture tiles. These look the same in light and dark mode. */
function raster(tiles: string[], attribution: string, maxzoom = 19): StyleSpecification {
  return {
    version: 8,
    sources: { base: { type: 'raster', tiles, tileSize: 256, maxzoom, attribution } },
    layers: [{ id: 'base', type: 'raster', source: 'base' }],
  };
}

const subdomains = (url: string) => ['a', 'b', 'c'].map((s) => url.replace('{s}', s));

export const MAP_STYLES = [
  {
    id: 'standard',
    name: 'Standard',
    source: 'OpenFreeMap',
    light: 'https://tiles.openfreemap.org/styles/liberty',
    dark: 'https://tiles.openfreemap.org/styles/dark',
  },
  {
    id: 'colorful',
    name: 'Colorful',
    source: 'VersaTiles',
    light: 'https://tiles.versatiles.org/assets/styles/colorful/style.json',
    dark: 'https://tiles.versatiles.org/assets/styles/colorful-dark/style.json',
  },
  {
    id: 'bright',
    name: 'Bright',
    source: 'OpenFreeMap',
    light: 'https://tiles.openfreemap.org/styles/bright',
  },
  {
    id: 'simple',
    name: 'Simple',
    source: 'OpenFreeMap',
    light: 'https://tiles.openfreemap.org/styles/positron',
    dark: 'https://tiles.openfreemap.org/styles/dark',
  },
  {
    id: 'osm',
    name: 'OpenStreetMap',
    source: 'openstreetmap.org',
    light: raster(['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], OSM),
  },
  {
    id: 'cyclosm',
    name: 'CyclOSM',
    source: 'OpenStreetMap France',
    light: raster(subdomains('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png'), `CyclOSM · ${OSM}`),
  },
  {
    id: 'humanitarian',
    name: 'Humanitarian',
    source: 'OpenStreetMap France',
    light: raster(subdomains('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'), `HOT · ${OSM}`),
  },
  {
    id: 'topo',
    name: 'Topo',
    source: 'OpenTopoMap',
    light: raster(
      subdomains('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'),
      `OpenTopoMap (CC-BY-SA) · ${OSM}`,
      17,
    ),
  },
] as const satisfies readonly {
  id: string;
  name: string;
  source: string;
  light: string | StyleSpecification;
  /** Used in dark mode; styles without one stay light. */
  dark?: string;
}[];

export type MapStyle = (typeof MAP_STYLES)[number];
export type MapStyleId = MapStyle['id'];

const chosen = storedSetting<MapStyleId>(
  'gtrack.map-style',
  MAP_STYLES.map((s) => s.id),
  'standard',
);

export const setMapStyle = chosen.set;

/** The map style you picked. */
export function useChosenMapStyle(): MapStyle {
  const id = chosen.use();
  return MAP_STYLES.find((s) => s.id === id) ?? MAP_STYLES[0];
}

/** What to draw for a style in the current light or dark mode. */
export function useStyleFor(style: MapStyle): string | StyleSpecification {
  const dark = useColorScheme() === 'dark';
  return dark && 'dark' in style ? style.dark : style.light;
}

/** What every map in the app draws. */
export function useMapStyle() {
  return useStyleFor(useChosenMapStyle());
}

/** Whether the map on screen is dark, so the status bar icons over it can stay readable. */
export function useMapIsDark() {
  const style = useChosenMapStyle();
  return useColorScheme() === 'dark' && 'dark' in style;
}
