import { useColorScheme, type TextStyle } from 'react-native';

// Design tokens for the Liquid Glass look (see the "G Track redesign" mock-up).

const light = {
  /** Screens that aren't over the map. */
  background: '#F6F7FA',
  /** Cards and grouped lists inside sheets. */
  surface: '#FFFFFF',
  /** Frosted panels floating over the map. */
  glass: 'rgba(250,251,253,0.78)',
  glassBorder: 'rgba(255,255,255,0.75)',
  text: '#0E1116',
  muted: '#4A5260',
  border: 'rgba(14,17,22,0.08)',
  /** Quiet buttons, chips, the sheet grabber. */
  fill: 'rgba(14,17,22,0.07)',
  accent: '#1E6BFF',
  accentText: '#0B4FD6',
  accentFill: 'rgba(30,107,255,0.12)',
  onAccent: '#FFFFFF',
  /** High-emphasis dark button (sign in, selected day). */
  strong: '#0E1116',
  onStrong: '#FFFFFF',
  danger: '#B02E0C',
  dangerFill: 'rgba(217,72,15,0.1)',
  success: '#1F9D55',
  warning: '#D9480F',
  shadow: '#0E1116',
};

const dark: typeof light = {
  background: '#0B0D10',
  surface: '#1A1D22',
  glass: 'rgba(24,27,32,0.8)',
  glassBorder: 'rgba(255,255,255,0.08)',
  text: '#F2F4F7',
  muted: '#A3AAB5',
  border: 'rgba(255,255,255,0.08)',
  fill: 'rgba(255,255,255,0.09)',
  accent: '#4C8DFF',
  accentText: '#8DB6FF',
  accentFill: 'rgba(76,141,255,0.16)',
  onAccent: '#FFFFFF',
  strong: '#F2F4F7',
  onStrong: '#0E1116',
  danger: '#FF8A65',
  dangerFill: 'rgba(255,138,101,0.12)',
  success: '#3DD17A',
  warning: '#FF9F43',
  shadow: '#000000',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Loaded in the root layout (@expo-google-fonts/inter). */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
};

export const type = {
  title: { fontFamily: fonts.extrabold, fontSize: 26, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: -0.3 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 16 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 13 },
  label: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 0.4 },
  button: { fontFamily: fonts.bold, fontSize: 16 },
} satisfies Record<string, TextStyle>;

/** Corner radii. */
export const radius = { sheet: 34, card: 22, tile: 18, pill: 999 };

/** Soft drop shadow for floating glass. */
export function floatShadow(colors: Colors) {
  return {
    shadowColor: colors.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  };
}
