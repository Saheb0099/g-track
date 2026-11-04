import { Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef } from '@maplibre/maplibre-react-native';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar, avatarColor } from '@/components/avatar';
import type { Member } from '@/features/groups/api';
import type { LivePosition } from '@/features/map/api';
import { boundsAround, circlePolygon } from '@/features/map/geo';
import { useMapStyle } from '@/features/map/styles';
import { fonts, useColors } from '@/lib/theme';

/**
 * A position older than this is drawn faded: the phone has stopped reporting. That's three
 * missed saves at the group's timing, and never under 20 minutes.
 */
export function staleAfterMs(saveEveryMin: number) {
  return Math.max(20, 3 * saveEveryMin) * 60_000;
}
/** Accuracy rings are only worth drawing when the fix is rough. */
const MIN_RING_M = 25;

export type GroupMapHandle = {
  focus: (userId: string) => void;
  /** Moves to the person without changing the zoom (for following). */
  follow: (userId: string) => void;
  showEveryone: () => void;
};

type Props = {
  positions: LivePosition[];
  members: Member[];
  now: number;
  meId?: string;
  selectedId: string | null;
  onSelect: (userId: string | null) => void;
  /** Space covered by floating UI, kept clear when framing everyone. */
  insets: { top: number; bottom: number };
  staleMs: number;
  /** The group shown: switching to another frames its people. */
  frameKey: string;
};

export const GroupMap = forwardRef<GroupMapHandle, Props>(function GroupMap(
  { positions, members, now, meId, selectedId, onSelect, insets, staleMs, frameKey },
  ref,
) {
  const colors = useColors();
  const mapStyle = useMapStyle();
  const camera = useRef<CameraRef>(null);
  const framedFor = useRef<string | null>(null);
  // The camera ignores moves made before the map has loaded its style.
  const [loaded, setLoaded] = useState(false);

  const people = useMemo(() => new globalThis.Map(members.map((m) => [m.userId, m])), [members]);
  const points = useMemo(() => positions.map((p) => [p.lng, p.lat] as [number, number]), [positions]);
  const padding = { top: insets.top + 40, bottom: insets.bottom + 40, left: 48, right: 72 };

  const rings = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: positions
        .filter((p) => (p.accuracyM ?? 0) >= MIN_RING_M)
        .map((p) => ({
          type: 'Feature',
          properties: {},
          geometry: circlePolygon([p.lng, p.lat], p.accuracyM ?? 0),
        })),
    }),
    [positions],
  );

  function showEveryone(duration = 800) {
    const bounds = boundsAround(points);
    if (bounds) camera.current?.fitBounds(bounds, { padding, duration });
  }

  function find(userId: string) {
    return positions.find((p) => p.userId === userId);
  }

  useImperativeHandle(ref, () => ({
    focus: (userId) => {
      const p = find(userId);
      // Offset so the person sits in the visible area above the sheet.
      if (p) camera.current?.flyTo({ center: [p.lng, p.lat], zoom: 16, duration: 800, padding });
    },
    follow: (userId) => {
      const p = find(userId);
      if (p) camera.current?.easeTo({ center: [p.lng, p.lat], duration: 600, padding });
    },
    showEveryone: () => showEveryone(),
  }));

  // Frame everyone once the map is ready and the first positions are in, and again (animated)
  // after switching groups, whose people may be somewhere else entirely.
  useEffect(() => {
    if (!loaded || points.length === 0 || framedFor.current === frameKey) return;
    const first = framedFor.current === null;
    framedFor.current = frameKey;
    showEveryone(first ? 0 : 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, points.length, frameKey]);

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={mapStyle}
      logo={false}
      compass={false}
      // The OpenStreetMap credit must stay visible: just under the top bar, clear of the sheet.
      attributionPosition={{ top: insets.top + 8, left: 16 }}
      // Texture rendering lets the frosted panels blur the map behind them.
      androidView="texture"
      onDidFinishLoadingMap={() => setLoaded(true)}
      onPress={() => onSelect(null)}>
      <Camera ref={camera} initialViewState={{ center: [0, 20], zoom: 1 }} />

      <GeoJSONSource id="accuracy" data={rings}>
        <Layer
          type="fill"
          id="accuracy-fill"
          paint={{ 'fill-color': colors.accent, 'fill-opacity': 0.12, 'fill-outline-color': colors.accent }}
        />
      </GeoJSONSource>

      {positions.map((p) => {
        const member = people.get(p.userId);
        const name = member?.displayName ?? '?';
        const stale = now - Date.parse(p.recordedAt) > staleMs;
        const selected = p.userId === selectedId;
        const label = p.userId === meId ? 'You' : name.split(' ')[0];
        const size = selected ? 54 : 46;
        return (
          // A pin: the marker's bottom edge, the tip of the pointer, sits exactly on the location.
          <Marker
            key={p.userId}
            id={p.userId}
            lngLat={[p.lng, p.lat]}
            anchor="bottom"
            onPress={() => onSelect(p.userId)}>
            <View style={[styles.marker, { opacity: stale ? 0.55 : 1 }]} accessibilityLabel={`${name} on the map`}>
              <View style={[styles.label, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                <Text style={[styles.labelText, { color: colors.text }]} numberOfLines={1}>
                  {label}
                </Text>
              </View>
              <View
                style={[
                  styles.pin,
                  {
                    borderRadius: size / 2 + 3,
                    borderColor: selected ? colors.accent : '#FFFFFF',
                    backgroundColor: avatarColor(name),
                  },
                ]}>
                <Avatar name={name} uri={member?.avatarUrl} size={size} />
              </View>
              <View style={[styles.pointer, { borderTopColor: selected ? colors.accent : '#FFFFFF' }]} />
            </View>
          </Marker>
        );
      })}
    </Map>
  );
});

const styles = StyleSheet.create({
  marker: { alignItems: 'center' },
  label: {
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  labelText: { fontFamily: fonts.bold, fontSize: 12 },
  pin: {
    borderWidth: 3,
    shadowColor: '#0E1116',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
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
});
