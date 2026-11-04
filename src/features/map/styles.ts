import { useColorScheme } from 'react-native';

// Free OpenStreetMap-based tiles, no key or account (https://openfreemap.org).
const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';

export function useMapStyle() {
  return useColorScheme() === 'dark' ? STYLE_DARK : STYLE_LIGHT;
}
