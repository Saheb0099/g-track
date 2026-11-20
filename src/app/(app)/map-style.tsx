import { Camera, Map } from '@maplibre/maplibre-react-native';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Icon } from '@/components/icon';
import { MAP_STYLES, setMapStyle, useChosenMapStyle, useStyleFor, type MapStyle } from '@/features/map/styles';
import { radius, type as typeStyles, useColors } from '@/lib/theme';

/** Previews show the area around you; without a known position, a view of the world. */
const PREVIEW_ZOOM = 14;
const WORLD = { center: [80, 20] as [number, number], zoom: 2 };
/** The next preview starts after this long even if the one before hasn't finished loading. */
const NEXT_PREVIEW_MS = 1000;

export default function MapStylePicker() {
  const colors = useColors();
  const safe = useSafeAreaInsets();
  const current = useChosenMapStyle();
  const here = useQuery({
    queryKey: ['last-known-position'],
    queryFn: () => Location.getLastKnownPositionAsync().catch(() => null),
    staleTime: Infinity,
  });
  // Previews load one after another, not all at once: each is a whole map with its own tiles,
  // and starting them together makes the screen slow to open. The count starts once the cards
  // show (after your position is in), so a slow position doesn't let several start together.
  const [started, setStarted] = useState(1);
  const showing = !here.isPending;
  useEffect(() => {
    if (!showing || started >= MAP_STYLES.length) return;
    const timer = setTimeout(() => setStarted((n) => n + 1), NEXT_PREVIEW_MS);
    return () => clearTimeout(timer);
  }, [showing, started]);
  const loaded = (index: number) => setStarted((n) => Math.max(n, index + 2));

  const view = here.data
    ? { center: [here.data.coords.longitude, here.data.coords.latitude] as [number, number], zoom: PREVIEW_ZOOM }
    : WORLD;

  function choose(style: MapStyle) {
    setMapStyle(style.id);
    router.back();
  }

  return (
    <ScrollView
      // Ends at Android's navigation bar, so nothing scrolls behind its buttons.
      style={{ backgroundColor: colors.background, marginBottom: safe.bottom }}
      contentContainerStyle={[styles.container, { paddingBottom: 32 }]}>
      <View style={styles.grid}>
        {/* Wait for the position so each preview opens in the right place. */}
        {!here.isPending &&
          MAP_STYLES.map((style, i) => (
            <Preview
              key={style.id}
              style={style}
              view={view}
              selected={style.id === current.id}
              started={i < started}
              onLoaded={() => loaded(i)}
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
  started,
  onLoaded,
  onPress,
}: {
  style: MapStyle;
  view: { center: [number, number]; zoom: number };
  selected: boolean;
  /** Its turn to load; until then the card is an empty frame. */
  started: boolean;
  /** Finished loading (or failed), so the next can start. */
  onLoaded: () => void;
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
          {
            backgroundColor: colors.surface,
            borderColor: selected ? colors.accent : colors.border,
            borderRadius: selected ? 24 : 16,
          },
          selected && styles.thumbSelected,
        ]}>
        {/* A still picture of the map: touches go to the card, not the map. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {started && (
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
              androidView="texture"
              onDidFinishLoadingMap={onLoaded}
              onDidFailLoadingMap={onLoaded}>
              <Camera initialViewState={view} />
            </Map>
          )}
        </View>
        {selected && (
          <View style={[styles.check, { backgroundColor: colors.accent }]}>
            <Icon name="check" size={18} color={colors.onAccent} />
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
