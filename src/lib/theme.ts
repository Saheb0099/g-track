import type { TextStyle } from 'react-native';

import { useAppColorScheme } from '@/lib/appearance';

// Material 3 colour roles from a blue seed (see the "G Track Material 3" design canvas).
// The older names (accent, muted, fill…) are kept as plain aliases used across the app.

const light = {
  /** Screens and the map's bottom sheet. */
  background: '#F3F3FA',
  /** List groups and cards on a screen or sheet. */
  surface: '#FFFFFF',
  /** Bars and buttons floating over the map (surface container). */
  glass: '#ECEDF4',
  surfaceHighest: '#E2E2E9',
  text: '#1A1B20',
  muted: '#44464F',
  /** Outline variant: dividers and quiet borders. */
  border: '#C5C6D0',
  /** Outline: outlined buttons, text fields. */
  outline: '#757780',
  /** Quiet fills: the sheet grabber, unselected chips, idle switch tracks. */
  fill: '#E2E2E9',
  accent: '#355CA8',
  accentText: '#355CA8',
  onAccent: '#FFFFFF',
  /** Primary container. */
  accentFill: '#D9E2FF',
  onAccentFill: '#1A438F',
  /** Secondary container: tonal buttons, selected chips. */
  tonal: '#DBE2F9',
  onTonal: '#3F4759',
  /** Kept for older call sites: the selected/on state of a tonal control. */
  strong: '#DBE2F9',
  onStrong: '#141B2C',
  danger: '#BA1A1A',
  dangerFill: '#FFDAD6',
  onDangerFill: '#93000A',
  success: '#2E7D32',
  successFill: '#C4EED0',
  onSuccessFill: '#0F5223',
  warning: '#B95000',
  shadow: '#000000',
};

const dark: typeof light = {
  background: '#17181D',
  surface: '#26282D',
  glass: '#26282D',
  surfaceHighest: '#33353A',
  text: '#E2E2E9',
  muted: '#C5C6D0',
  border: '#44464F',
  outline: '#8F9099',
  fill: '#33353A',
  accent: '#B0C6FF',
  accentText: '#B0C6FF',
  onAccent: '#002D6E',
  accentFill: '#1A438F',
  onAccentFill: '#D9E2FF',
  tonal: '#3F4759',
  onTonal: '#DBE2F9',
  strong: '#3F4759',
  onStrong: '#DBE2F9',
  danger: '#FFB4AB',
  dangerFill: '#93000A',
  onDangerFill: '#FFDAD6',
  success: '#8CD98F',
  successFill: '#1E4D2B',
  onSuccessFill: '#B7F1BD',
  warning: '#FFB77C',
  shadow: '#000000',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useAppColorScheme() === 'dark' ? dark : light;
}

/**
 * The palette for a light or dark background. Things drawn on the map (pins, labels, paths) use
 * the map's own brightness rather than the app's theme: a map with no dark version stays light
 * in dark mode, and dark pins on it looked out of place.
 */
export function colorsFor(darkBackground: boolean): Colors {
  return darkBackground ? dark : light;
}

/**
 * Roboto, bundled and loaded in the root layout (@expo-google-fonts/roboto). Android's own
 * "sans-serif" isn't always Roboto: some phone makers (Vivo, Xiaomi…) swap in their own font.
 */
const roboto = 'Roboto_400Regular';
const robotoMedium = 'Roboto_500Medium';

export const fonts = {
  regular: roboto,
  medium: robotoMedium,
  semibold: robotoMedium,
  bold: robotoMedium,
  extrabold: robotoMedium,
};

const medium = { fontFamily: robotoMedium } as const;

/** The Material 3 type scale, by what each style is used for. */
export const type = {
  /** Headline: screen titles, a person's name. */
  title: { ...medium, fontSize: 28, lineHeight: 36 },
  /** Title large: sheet headings. */
  heading: { ...medium, fontSize: 22, lineHeight: 28 },
  /** Title medium: list item headlines. */
  bodyStrong: { ...medium, fontSize: 16, lineHeight: 24, letterSpacing: 0.15 },
  /** Body large. */
  body: { fontFamily: roboto, fontSize: 16, lineHeight: 24 },
  /** Body medium: supporting text. */
  caption: { fontFamily: roboto, fontSize: 14, lineHeight: 20 },
  /** Label large: section labels. */
  label: { ...medium, fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  button: { ...medium, fontSize: 15, letterSpacing: 0.1 },
} satisfies Record<string, TextStyle>;

/** Corner radii. */
export const radius = { sheet: 28, card: 20, tile: 16, field: 8, pill: 999 };

/** Elevation for bars and buttons floating over the map. */
export function floatShadow(colors: Colors) {
  return {
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  };
}
