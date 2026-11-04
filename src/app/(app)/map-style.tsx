import { Ionicons } from '@expo/vector-icons';
import { Camera, Map } from '@maplibre/maplibre-react-native';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAP_STYLES, setMapStyle, useChosenMapStyle, useStyleFor, type MapStyle } from '@/features/map/styles';
import { radius, type as typeStyles, useColors } from '@/lib/theme';

/** Previews show the area around you; without a known position, a view of the world. */
const PREVIEW_ZOOM = 14;
const WORLD = { center: [80, 20] as [number, number], zoom: 2 };

export default function MapStylePicker() {
  const colors = useColors();
  const safe = useSafeAreaInsets();
  const current = useChosenMapStyle();
  const here = useQuery({
    queryKey: ['last-known-position'],
    queryFn: () => Location.getLastKnownPositionAsync().catch(() => null),
    staleTime: Infinity,
  });
  const view = here.data
    ? { center: [here.data.coords.longitude, here.data.coords.latitude] as [number, number], zoom: PREVIEW_ZOOM }
    : WORLD;

  function choose(style: MapStyle) {
    setMapStyle(style.id);
    router.back();
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingBottom: safe.bottom + 32 }]}>
      <View style={styles.grid}>
        {/* Wait for the position so each preview opens in the right place. */}
        {!here.isPending &&
          MAP_STYLES.map((style) => (
            <Preview
              key={style.id}
              style={style}
              view={view}
              selected={style.id === current.id}
              onPress={() => choose(style)}
            />
          ))}
      </View>
      <Text style={[typeStyles.caption, styles.note, { color: colors.muted }]}>
        All maps use free OpenStreetMap data. Some have no dark version and stay light in dark mode.
      </Text>
    </ScrollView>
  );
}

function Preview({
  style,
  view,
  selected,
  onPress,
}: {
  style: MapStyle;
  view: { center: [number, number]; zoom: number };
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const mapStyle = useStyleFor(style);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${style.name} map`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.7 : 1 }]}>
      <View
        style={[
          styles.thumb,
          { backgroundColor: colors.surface, borderColor: selected ? colors.accent : colors.border },
          selected && styles.thumbSelected,
        ]}>
        {/* A still picture of the map: touches go to the card, not the map. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Map
            style={StyleSheet.absoluteFill}
            mapStyle={mapStyle}
            logo={false}
            attribution={false}
            compass={false}
            dragPan={false}
            touchZoom={false}
            touchRotate={false}
            touchPitch={false}
            doubleTapZoom={false}
            androidView="texture">
            <Camera initialViewState={view} />
          </Map>
        </View>
        {selected && (
          <View style={[styles.check, { backgroundColor: colors.accent }]}>
            <Ionicons name="checkmark" size={16} color={colors.onAccent} />
          </View>
        )}
      </View>
      <View>
        <Text style={[typeStyles.bodyStrong, { color: colors.text }]} numberOfLines={1}>
          {style.name}
        </Text>
        <Text style={[typeStyles.caption, { color: colors.muted, fontSize: 12 }]} numberOfLines={1}>
          {style.source}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 },
  cell: { width: '48%', gap: 8 },
  thumb: { height: 118, borderRadius: radius.tile, borderWidth: 1, overflow: 'hidden' },
  thumbSelected: { borderWidth: 3 },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { textAlign: 'center', lineHeight: 19 },
});
