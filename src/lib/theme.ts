import { useColorScheme } from 'react-native';

const light = {
  background: '#ffffff',
  text: '#111111',
  muted: '#6b6b6b',
  border: '#dddddd',
  accent: '#1f6feb',
  onAccent: '#ffffff',
  danger: '#d33333',
};

const dark: typeof light = {
  background: '#000000',
  text: '#ffffff',
  muted: '#9a9a9a',
  border: '#333333',
  accent: '#4c8dff',
  onAccent: '#ffffff',
  danger: '#ff6b6b',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
