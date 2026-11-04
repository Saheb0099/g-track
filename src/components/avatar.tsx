import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { fonts } from '@/lib/theme';

// Initials avatars get a stable colour per person, so friends are easy to tell apart.
const COLORS = ['#1E6BFF', '#E8590C', '#7048E8', '#0CA678', '#D6336C', '#1098AD', '#F59F00', '#5C7CFA'];

export function avatarColor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

type Props = { name: string; uri?: string | null; size?: number; dim?: boolean };

export function Avatar({ name, uri, size = 42, dim = false }: Props) {
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
    <View style={[styles.fallback, box, { backgroundColor: avatarColor(name) }]} accessibilityLabel={name}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.extrabold, color: '#FFFFFF' },
});
