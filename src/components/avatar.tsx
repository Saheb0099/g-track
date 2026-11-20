import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useAppColorScheme } from '@/lib/appearance';
import { fonts } from '@/lib/theme';

// Initials avatars get a stable tonal colour per person, so friends are easy to tell apart:
// [container, text] in light mode, then the dark-mode pair.
const PAIRS: [light: [string, string], dark: [string, string]][] = [
  [
    ['#D9E2FF', '#1A438F'],
    ['#1A438F', '#D9E2FF'],
  ],
  [
    ['#FDD7FA', '#593D59'],
    ['#593D59', '#FDD7FA'],
  ],
  [
    ['#CDEDA3', '#354E16'],
    ['#354E16', '#CDEDA3'],
  ],
  [
    ['#FFDBC9', '#723600'],
    ['#723600', '#FFDBC9'],
  ],
  [
    ['#BEEAF6', '#004E5C'],
    ['#004E5C', '#BEEAF6'],
  ],
  [
    ['#EADDFF', '#4F378B'],
    ['#4F378B', '#EADDFF'],
  ],
  [
    ['#FFE08B', '#574500'],
    ['#574500', '#FFE08B'],
  ],
  [
    ['#FFDAD6', '#8C1D18'],
    ['#8C1D18', '#FFDAD6'],
  ],
];

/** A person's avatar colours: [background, text]. */
export function avatarColors(name: string, dark: boolean): [string, string] {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PAIRS[hash % PAIRS.length][dark ? 1 : 0];
}

type Props = { name: string; uri?: string | null; size?: number; dim?: boolean };

export function Avatar({ name, uri, size = 40, dim = false }: Props) {
  const [background, text] = avatarColors(name, useAppColorScheme() === 'dark');
  const box = { width: size, height: size, borderRadius: size / 2, opacity: dim ? 0.55 : 1 };

  if (uri) {
    return <Image source={{ uri }} style={box} contentFit="cover" accessibilityLabel={name} />;
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <View style={[styles.fallback, box, { backgroundColor: background }]} accessibilityLabel={name}>
      <Text style={[styles.initials, { fontSize: size * 0.4, color: text }]}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.medium },
});
