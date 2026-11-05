import { Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef } from '@maplibre/maplibre-react-native';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar, avatarColor } from '@/components/avatar';
import type { Member } from '@/features/groups/api';
import { distanceMeters } from '@/features/location/rules';
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
/** People closer than this share one pin, so their pins and names don't pile up on each other. */
const SHARED_PIN_M = 60;
/** A shared pin shows this many faces, then "+N". */
const MAX_FACES = 3;

/** Groups positions that are close together (you first in yours), for shared pins. */
function groupClose(positions: LivePosition[], meId?: string): LivePosition[][] {
  const groups: LivePosition[][] = [];
  const asFix = (p: LivePosition) => ({ lat: p.lat, lng: p.lng, time: 0 });
  for (const p of positions) {
    const near = groups.find((g) => distanceMeters(asFix(g[0]), asFix(p)) <= SHARED_PIN_M);
    if (near) near.push(p);
    else groups.push([p]);
  }
  return groups.map((g) => [...g].sort((a, b) => Number(b.userId === meId) - Number(a.userId === meId)));
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
  // A tap on a pin also reaches the map under it, whose tap means "deselect". Remembered here, so
  // the map can tell a tap on empty map from one that landed on a pin, whichever arrives first.
  const pinTappedAt = useRef(0);
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
      onPress={() =>
        setTimeout(() => {
          if (Date.now() - pinTappedAt.current > 400) onSelect(null);
        }, 80)
      }>
      <Camera ref={camera} initialViewState={{ center: [0, 20], zoom: 1 }} />

      <GeoJSONSource id="accuracy" data={rings}>
        <Layer
          type="fill"
          id="accuracy-fill"
          paint={{ 'fill-color': colors.accent, 'fill-opacity': 0.12, 'fill-outline-color': colors.accent }}
        />
      </GeoJSONSource>

      {groupClose(positions, meId).map((group) => {
        const first = (p: LivePosition) =>
          p.userId === meId ? 'You' : (people.get(p.userId)?.displayName ?? '?').split(' ')[0];
        const names = group.map(first);
        const label = names.length <= 2 ? names.join(', ') : `${names[0]} +${names.length - 1}`;
        const selected = group.some((p) => p.userId === selectedId);
        const stale = group.every((p) => now - Date.parse(p.recordedAt) > staleMs);
        // Tapping a shared pin opens a friend's card rather than your own.
        const target = group.find((p) => p.userId !== meId) ?? group[0];
        const lat = group.reduce((sum, p) => sum + p.lat, 0) / group.length;
        const lng = group.reduce((sum, p) => sum + p.lng, 0) / group.length;
        const faces = group.slice(0, group.length > MAX_FACES ? MAX_FACES - 1 : MAX_FACES);
        const extra = group.length - faces.length;
        const size = group.length > 1 ? 40 : selected ? 54 : 46;
        const ring = selected ? colors.accent : '#FFFFFF';
        return (
          // A pin: the marker's bottom edge, the tip of the pointer, sits exactly on the location.
          <Marker
            key={group.map((p) => p.userId).join(',')}
            id={group.map((p) => p.userId).join(',')}
            lngLat={[lng, lat]}
            anchor="bottom"
            onPress={() => {
              pinTappedAt.current = Date.now();
              onSelect(target.userId);
            }}>
            <View
              style={[styles.marker, { opacity: stale ? 0.55 : 1 }]}
              accessibilityLabel={`${names.join(', ')} on the map`}>
              <View style={[styles.label, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                <Text style={[styles.labelText, { color: colors.text }]} numberOfLines={1}>
                  {label}
                </Text>
              </View>
              <View style={styles.faces}>
                {faces.map((p, i) => {
                  const member = people.get(p.userId);
                  const name = member?.displayName ?? '?';
                  return (
                    <View
                      key={p.userId}
                      style={[
                        styles.pin,
                        i > 0 && styles.overlap,
                        { borderRadius: size / 2 + 3, borderColor: ring, backgroundColor: avatarColor(name) },
                      ]}>
                      <Avatar name={name} uri={member?.avatarUrl} size={size} />
                    </View>
                  );
                })}
                {extra > 0 && (
                  <View
                    style={[
                      styles.pin,
                      styles.overlap,
                      styles.more,
                      {
                        width: size + 6,
                        height: size + 6,
                        borderRadius: size / 2 + 3,
                        borderColor: ring,
                        backgroundColor: colors.strong,
                      },
                    ]}>
                    <Text style={[styles.labelText, { color: colors.onStrong }]}>+{extra}</Text>
                  </View>
                )}
              </View>
              <View style={[styles.pointer, { borderTopColor: ring }]} />
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
  faces: { flexDirection: 'row' },
  overlap: { marginLeft: -14 },
  more: { alignItems: 'center', justifyContent: 'center' },
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
