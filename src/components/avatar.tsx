import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/lib/theme';

type Props = { name: string; uri?: string | null; size?: number };

export function Avatar({ name, uri, size = 40 }: Props) {
  const colors = useColors();
  const box = { width: size, height: size, borderRadius: size / 2 };

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
    <View style={[styles.fallback, box, { backgroundColor: colors.accent }]} accessibilityLabel={name}>
      <Text style={[styles.initials, { color: colors.onAccent, fontSize: size * 0.4 }]}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontWeight: '700' },
});
