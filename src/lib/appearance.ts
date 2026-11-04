import { Appearance } from 'react-native';

import { storedSetting } from '@/lib/stored-setting';

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

const theme = storedSetting<Theme>('gtrack.theme', THEMES, 'system');

// Overriding the phone's setting app-wide means useColorScheme(), alerts and Android's own
// screens all follow the choice, with nothing else to change.
function apply(choice: Theme) {
  Appearance.setColorScheme(choice === 'system' ? 'unspecified' : choice);
}

/** Call once at startup, before the first screen draws. */
export function applySavedTheme() {
  apply(theme.get());
}

export function setTheme(choice: Theme) {
  theme.set(choice);
  apply(choice);
}

export const useTheme = theme.use;
