import { Appearance, AppState, useColorScheme } from 'react-native';

import { storedSetting } from '@/lib/stored-setting';

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

const theme = storedSetting<Theme>('gtrack.theme', THEMES, 'system');

/** The choice in Settings: Automatic (system), Light or Dark. */

// Overriding the phone's setting app-wide makes alerts and Android's own screens follow the
// choice too. Android can drop the override when the app is reopened, so it's applied again each
// time the app comes back, and the app's own screens read the choice directly (useAppColorScheme).
function apply(choice: Theme) {
  Appearance.setColorScheme(choice === 'system' ? 'unspecified' : choice);
}

/** Call once at startup, before the first screen draws. */
export function applySavedTheme() {
  apply(theme.get());
  AppState.addEventListener('change', (state) => {
    if (state === 'active') apply(theme.get());
  });
}

/**
 * Light or dark for the app's own screens: the choice in Settings, or the phone's setting when
 * it's Automatic. Use this rather than React Native's useColorScheme.
 */
export function useAppColorScheme(): 'light' | 'dark' {
  const choice = useTheme();
  const phone = useColorScheme();
  if (choice !== 'system') return choice;
  return phone === 'dark' ? 'dark' : 'light';
}

export function setTheme(choice: Theme) {
  theme.set(choice);
  apply(choice);
}

export const useTheme = theme.use;
