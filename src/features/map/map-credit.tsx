import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { useChosenMapStyle, useMapIsDark } from '@/features/map/styles';
import { colorsFor, type as typeStyles } from '@/lib/theme';

/**
 * How long the full credit shows before it folds into a small (i). OpenStreetMap's attribution
 * guideline allows fading the credit "automatically after five seconds", as long as it can still
 * be found: the (i) opens About, which credits every map provider.
 */
const SHOWN_MS = 5_000;

/**
 * The map's credit, in place of MapLibre's (i) button: "© OpenStreetMap" plus the provider of
 * the map on show (OpenTopoMap, CARTO...). It shows when the map opens or the map style
 * changes, then folds into a small (i) in the corner. Tapping either opens About. `mapReady`:
 * the map has finished loading.
 */
export function MapCredit({ top, mapReady }: { top: number; mapReady: boolean }) {
  const colors = colorsFor(useMapIsDark());
  const style = useChosenMapStyle();
  const extra = 'credit' in style ? ` · ${style.credit}` : '';
  const text = `© OpenStreetMap${extra}`;
  // The credit last folded away. A new map style has a different credit, so it shows again and
  // its provider is seen too.
  const [foldedFor, setFoldedFor] = useState<string | null>(null);
  const expanded = foldedFor !== text;

  // Counted from when the map has drawn, so the credit is seen with the map, not folded away
  // while it's still loading.
  useEffect(() => {
    if (!mapReady) return;
    const timer = setTimeout(() => setFoldedFor(text), SHOWN_MS);
    return () => clearTimeout(timer);
  }, [text, mapReady]);

  return (
    <Pressable
      onPress={() => router.push('/about')}
      accessibilityRole="button"
      accessibilityLabel={`Map data from OpenStreetMap${extra}. Opens About and map credits`}
      hitSlop={12}
      style={[styles.corner, { top }]}>
      {expanded ? (
        <Animated.View
          key="text"
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(250)}
          style={[styles.label, { backgroundColor: `${colors.glass}D9` }]}>
          <Text style={[typeStyles.caption, styles.text, { color: colors.muted }]}>{text}</Text>
        </Animated.View>
      ) : (
        <Animated.View
          key="info"
          entering={FadeIn.duration(250)}
          style={[styles.info, { backgroundColor: `${colors.glass}D9` }]}>
          <Icon name="info" size={14} color={colors.muted} />
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  corner: { position: 'absolute', left: 16 },
  label: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontSize: 11, lineHeight: 16 },
  info: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
