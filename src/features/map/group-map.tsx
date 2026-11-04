import { Ionicons } from '@expo/vector-icons';
import { Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef } from '@maplibre/maplibre-react-native';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import type { Member } from '@/features/groups/api';
import type { LivePosition } from '@/features/map/api';
import { boundsAround, circlePolygon } from '@/features/map/geo';
import { useMapStyle } from '@/features/map/styles';
import { useColors } from '@/lib/theme';

/** A position older than this is drawn faded: the phone has stopped reporting. */
const STALE_MS = 20 * 60_000;
/** Accuracy rings are only worth drawing when the fix is rough. */
const MIN_RING_M = 30;
const EDGE_PADDING = { top: 60, right: 60, bottom: 60, left: 60 };

export type GroupMapHandle = {
  focus: (userId: string) => void;
  showEveryone: () => void;
};

type Props = { positions: LivePosition[]; members: Member[]; now: number };

export const GroupMap = forwardRef<GroupMapHandle, Props>(function GroupMap({ positions, members, now }, ref) {
  const colors = useColors();
  const mapStyle = useMapStyle();
  const camera = useRef<CameraRef>(null);
  const fittedOnce = useRef(false);
  // The camera ignores moves made before the map has loaded its style.
  const [loaded, setLoaded] = useState(false);

  const names = useMemo(() => new globalThis.Map(members.map((m) => [m.userId, m])), [members]);
  const ringColor = (stale: boolean) => (stale ? colors.muted : colors.accent);
  const points = useMemo(() => positions.map((p) => [p.lng, p.lat] as [number, number]), [positions]);

  const rings = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: positions
        .filter((p) => (p.accuracyM ?? 0) >= MIN_RING_M)
        .map((p) => ({
          type: 'Feature',
          properties: { userId: p.userId },
          geometry: circlePolygon([p.lng, p.lat], p.accuracyM ?? 0),
        })),
    }),
    [positions],
  );

  function showEveryone(duration = 800) {
    const bounds = boundsAround(points);
    if (bounds) camera.current?.fitBounds(bounds, { padding: EDGE_PADDING, duration });
  }

  useImperativeHandle(ref, () => ({
    focus: (userId) => {
      const p = positions.find((x) => x.userId === userId);
      if (p) camera.current?.flyTo({ center: [p.lng, p.lat], zoom: 15, duration: 800 });
    },
    showEveryone: () => showEveryone(),
  }));

  // Frame everyone once, when the first positions arrive; after that the user is in control.
  useEffect(() => {
    if (!loaded || fittedOnce.current || points.length === 0) return;
    fittedOnce.current = true;
    showEveryone(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, points.length]);

  return (
    <View style={styles.container}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle}
        logo={false}
        compass
        onDidFinishLoadingMap={() => setLoaded(true)}>
        <Camera ref={camera} initialViewState={{ center: [0, 20], zoom: 1 }} />

        <GeoJSONSource id="accuracy" data={rings}>
          <Layer
            type="fill"
            id="accuracy-fill"
            paint={{ 'fill-color': colors.accent, 'fill-opacity': 0.12, 'fill-outline-color': colors.accent }}
          />
        </GeoJSONSource>

        {positions.map((p) => {
          const member = names.get(p.userId);
          const stale = now - Date.parse(p.recordedAt) > STALE_MS;
          return (
            // A pin: the marker's bottom edge, the tip of the pointer, sits exactly on the location.
            <Marker key={p.userId} id={p.userId} lngLat={[p.lng, p.lat]} anchor="bottom">
              <View style={[styles.marker, { opacity: stale ? 0.5 : 1 }]}>
                <Text
                  numberOfLines={1}
                  style={[styles.name, { color: colors.text, backgroundColor: colors.background }]}>
                  {member?.displayName.split(' ')[0] ?? ''}
                </Text>
                <View style={[styles.ring, { borderColor: ringColor(stale) }]}>
                  <Avatar name={member?.displayName ?? '?'} uri={member?.avatarUrl} size={36} />
                </View>
                <View style={[styles.pointer, { borderTopColor: ringColor(stale) }]} />
              </View>
            </Marker>
          );
        })}
      </Map>

      {points.length > 1 && (
        <Pressable
          onPress={() => showEveryone()}
          accessibilityLabel="Show everyone"
          style={[styles.fab, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="people-outline" size={20} color={colors.text} />
        </Pressable>
      )}
      {points.length === 0 && (
        <View style={[styles.empty, { backgroundColor: colors.background }]}>
          <Text style={{ color: colors.muted }}>No one in this group is sharing a location yet.</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { height: 340, borderRadius: 14, overflow: 'hidden' },
  marker: { alignItems: 'center' },
  ring: { borderWidth: 3, borderRadius: 24, padding: 1 },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  name: { marginBottom: 2, fontSize: 12, fontWeight: '700', paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden' },
  fab: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
});
