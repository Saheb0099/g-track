import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/text';
import { useChosenMapStyle } from '@/features/map/styles';
import { type as typeStyles, useColors } from '@/lib/theme';

/**
 * The map's credit. OpenStreetMap's licence asks for it on the map itself, so a small
 * "© OpenStreetMap" stays in the corner; tapping it opens About, which credits every map
 * provider. A provider that asks for its own credit on the map (CARTO) is added after it.
 * Used in place of MapLibre's (i) button.
 */
export function MapCredit({ top }: { top: number }) {
  const colors = useColors();
  const style = useChosenMapStyle();
  const extra = 'credit' in style ? ` · ${style.credit}` : '';
  return (
    <Pressable
      onPress={() => router.push('/about')}
      accessibilityRole="button"
      accessibilityLabel={`Map data from OpenStreetMap${extra}. Opens About and map credits`}
      hitSlop={8}
      style={[styles.credit, { top, backgroundColor: `${colors.glass}D9` }]}>
      <Text style={[typeStyles.caption, styles.text, { color: colors.muted }]}>
        © OpenStreetMap{extra}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  credit: { position: 'absolute', left: 16, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontSize: 11, lineHeight: 16 },
});
