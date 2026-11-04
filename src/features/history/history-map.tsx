import { Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef } from '@maplibre/maplibre-react-native';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usable, type HistoryPoint, type Stay } from '@/features/history/timeline';
import { boundsAround } from '@/features/map/geo';
import { useMapStyle } from '@/features/map/styles';
import { useColors } from '@/lib/theme';

const EDGE_PADDING = { top: 50, right: 50, bottom: 50, left: 50 };

export type HistoryMapHandle = { focus: (lat: number, lng: number) => void };

type Props = { points: HistoryPoint[]; stays: Stay[]; selected: Stay | null };

export const HistoryMap = forwardRef<HistoryMapHandle, Props>(function HistoryMap({ points, stays, selected }, ref) {
  const colors = useColors();
  const mapStyle = useMapStyle();
  const camera = useRef<CameraRef>(null);
  // The camera ignores moves made before the map has loaded its style.
  const [loaded, setLoaded] = useState(false);

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
    focus: (lat, lng) => camera.current?.flyTo({ center: [lng, lat], zoom: 15.5, duration: 700 }),
  }));

  // Frame the whole day once the map is ready, and again whenever a different day is shown.
  useEffect(() => {
    const bounds = boundsAround(coords);
    if (loaded && bounds) camera.current?.fitBounds(bounds, { padding: EDGE_PADDING, duration: 400 });
  }, [coords, loaded]);

  const start = path[0];
  const end = path.at(-1);

  return (
    <View style={styles.container}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle}
        logo={false}
        compass
        onDidFinishLoadingMap={() => setLoaded(true)}>
        <Camera ref={camera} initialViewState={{ center: [0, 20], zoom: 1 }} />

        {coords.length > 1 && (
          <GeoJSONSource id="path" data={line}>
            <Layer
              type="line"
              id="path-line"
              paint={{ 'line-color': colors.accent, 'line-width': 4, 'line-opacity': 0.85 }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
          </GeoJSONSource>
        )}

        <GeoJSONSource id="stays" data={dots}>
          <Layer
            type="circle"
            id="stay-dots"
            paint={{
              'circle-radius': 7,
              'circle-color': colors.background,
              'circle-stroke-color': colors.accent,
              'circle-stroke-width': 3,
            }}
          />
        </GeoJSONSource>

        {start && (
          <Marker id="start" lngLat={[start.lng, start.lat]} anchor="center">
            <View style={[styles.pin, { backgroundColor: '#2DA44E', borderColor: colors.background }]} />
          </Marker>
        )}
        {end && path.length > 1 && (
          <Marker id="end" lngLat={[end.lng, end.lat]} anchor="center">
            <View style={[styles.pin, { backgroundColor: colors.danger, borderColor: colors.background }]} />
          </Marker>
        )}
        {selected && (
          <Marker id="selected" lngLat={[selected.lng, selected.lat]} anchor="center">
            <View style={[styles.selected, { borderColor: colors.accent }]} />
          </Marker>
        )}
      </Map>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { height: 320, borderRadius: 14, overflow: 'hidden' },
  pin: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  selected: { width: 34, height: 34, borderRadius: 17, borderWidth: 3 },
});
