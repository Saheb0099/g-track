import { Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef } from '@maplibre/maplibre-react-native';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usable, type HistoryPoint, type Stay } from '@/features/history/timeline';
import { boundsAround } from '@/features/map/geo';
import { useMapStyle } from '@/features/map/styles';
import { useColors } from '@/lib/theme';

export type HistoryMapHandle = { focus: (lat: number, lng: number) => void };

type Props = {
  points: HistoryPoint[];
  stays: Stay[];
  selected: Stay | null;
  /** Space covered by floating UI, kept clear when framing the day. */
  insets: { top: number; bottom: number };
};

export const HistoryMap = forwardRef<HistoryMapHandle, Props>(function HistoryMap(
  { points, stays, selected, insets },
  ref,
) {
  const colors = useColors();
  const mapStyle = useMapStyle();
  const camera = useRef<CameraRef>(null);
  // The camera ignores moves made before the map has loaded its style.
  const [loaded, setLoaded] = useState(false);
  const padding = { top: insets.top + 32, bottom: insets.bottom + 32, left: 40, right: 40 };

  const path = useMemo(() => usable(points), [points]);
  const coords = useMemo(() => path.map((p) => [p.lng, p.lat] as [number, number]), [path]);

  const line = useMemo<GeoJSON.Feature>(
    () => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }),
    [coords],
  );
  const dots = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: stays.map((s) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      })),
    }),
    [stays],
  );

  useImperativeHandle(ref, () => ({
    focus: (lat, lng) => camera.current?.flyTo({ center: [lng, lat], zoom: 16, duration: 700, padding }),
  }));

  // Frame the whole day once the map is ready, and again whenever a different day is shown.
  useEffect(() => {
    const bounds = boundsAround(coords);
    if (loaded && bounds) camera.current?.fitBounds(bounds, { padding, duration: 400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, loaded]);

  const start = path[0];
  const end = path.at(-1);

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={mapStyle}
      logo={false}
      compass={false}
      // The OpenStreetMap credit must stay visible: below the floating controls, clear of the sheet.
      attributionPosition={{ top: insets.top + 8, left: 16 }}
      // Texture rendering lets the frosted panels blur the map behind them.
      androidView="texture"
      onDidFinishLoadingMap={() => setLoaded(true)}>
      <Camera ref={camera} initialViewState={{ center: [0, 20], zoom: 1 }} />

      {coords.length > 1 && (
        <GeoJSONSource id="path" data={line}>
          <Layer
            type="line"
            id="path-line"
            paint={{ 'line-color': colors.accent, 'line-width': 5, 'line-opacity': 0.9 }}
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          />
        </GeoJSONSource>
      )}

      <GeoJSONSource id="stays" data={dots}>
        <Layer
          type="circle"
          id="stay-dots"
          paint={{
            'circle-radius': 8,
            'circle-color': '#FFFFFF',
            'circle-stroke-color': colors.accent,
            'circle-stroke-width': 4,
          }}
        />
      </GeoJSONSource>

      {start && (
        <Marker id="start" lngLat={[start.lng, start.lat]} anchor="center">
          <View style={[styles.pin, { backgroundColor: colors.success }]} />
        </Marker>
      )}
      {end && path.length > 1 && (
        <Marker id="end" lngLat={[end.lng, end.lat]} anchor="center">
          <View style={[styles.pin, { backgroundColor: colors.warning }]} />
        </Marker>
      )}
      {selected && (
        <Marker id="selected" lngLat={[selected.lng, selected.lat]} anchor="center">
          <View style={[styles.selected, { borderColor: colors.accent }]} />
        </Marker>
      )}
    </Map>
  );
});

const styles = StyleSheet.create({
  pin: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#FFFFFF' },
  selected: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, backgroundColor: 'rgba(30,107,255,0.12)' },
});
