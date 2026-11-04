import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMembers } from '@/features/groups/api';
import { recentDays, useDayHistory } from '@/features/history/api';
import { HistoryMap, type HistoryMapHandle } from '@/features/history/history-map';
import { buildTimeline, travelledM, type Stay, type TimelineItem } from '@/features/history/timeline';
import { friendlyError } from '@/lib/errors';
import { useColors } from '@/lib/theme';

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function duration(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const distance = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export default function MemberHistory() {
  const colors = useColors();
  const { id, userId } = useLocalSearchParams<{ id: string; userId: string }>();
  const members = useMembers(id);
  const member = members.data?.find((m) => m.userId === userId);

  const days = useMemo(() => recentDays(), []);
  const [dayIndex, setDayIndex] = useState(0);
  const day = days[dayIndex];
  const history = useDayHistory(userId, day);

  const points = useMemo(() => history.data ?? [], [history.data]);
  const timeline = useMemo(() => buildTimeline(points), [points]);
  const stays = useMemo(() => timeline.filter((i): i is Stay => i.kind === 'stay'), [timeline]);
  const [selected, setSelected] = useState<Stay | null>(null);
  const map = useRef<HistoryMapHandle>(null);

  const firstName = member?.displayName.split(' ')[0];

  function pickDay(index: number) {
    setDayIndex(index);
    setSelected(null);
  }

  function showStay(stay: Stay) {
    setSelected(stay);
    map.current?.focus(stay.lat, stay.lng);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: firstName ? `${firstName}'s week` : 'History' }} />

      {/* flexGrow 0: a horizontal ScrollView otherwise stretches to fill the column's height. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.daysBar}
        contentContainerStyle={styles.days}>
        {days.map((d, i) => {
          const active = i === dayIndex;
          return (
            <Pressable
              key={d.start.toISOString()}
              onPress={() => pickDay(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accent : 'transparent' },
              ]}>
              <Text style={[styles.chipText, { color: active ? colors.onAccent : colors.text }]}>{d.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.mapArea}>
        <HistoryMap ref={map} points={points} stays={stays} selected={selected} />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {history.isPending ? (
          <ActivityIndicator style={styles.loading} />
        ) : history.isError ? (
          <Text style={{ color: colors.danger }}>{friendlyError(history.error)}</Text>
        ) : points.length === 0 ? (
          <Text style={[styles.empty, { color: colors.muted }]}>No locations were recorded on this day.</Text>
        ) : (
          <>
            <Text style={[styles.summary, { color: colors.muted }]}>
              {stays.length} {stays.length === 1 ? 'place' : 'places'} · {distance(travelledM(timeline))} travelled ·{' '}
              {points.length} points from {time(points[0].time)} to {time(points.at(-1)!.time)}
            </Text>
            {timeline.length === 0 && (
              <Text style={[styles.empty, { color: colors.muted }]}>
                On the move all day, with no stop of 10 minutes or more.
              </Text>
            )}
            {timeline.map((item, i) => (
              <TimelineRow
                key={`${item.kind}-${item.from}`}
                item={item}
                index={stays.indexOf(item as Stay) + 1}
                selected={item === selected}
                onPress={item.kind === 'stay' ? () => showStay(item) : undefined}
                last={i === timeline.length - 1}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function TimelineRow({
  item,
  index,
  selected,
  onPress,
  last,
}: {
  item: TimelineItem;
  index: number;
  selected: boolean;
  onPress?: () => void;
  last: boolean;
}) {
  const colors = useColors();
  const stay = item.kind === 'stay';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={styles.rail}>
        <View
          style={[
            styles.node,
            stay
              ? { borderColor: colors.accent, backgroundColor: selected ? colors.accent : colors.background }
              : { borderColor: colors.border, backgroundColor: colors.border, width: 10, height: 10 },
          ]}
        />
        {!last && <View style={[styles.line, { backgroundColor: colors.border }]} />}
      </View>
      <View style={styles.rowText}>
        {stay ? (
          <>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              Place {index} · {duration(item.to - item.from)}
            </Text>
            <Text style={{ color: colors.muted }}>
              {time(item.from)} – {time(item.to)}
            </Text>
          </>
        ) : (
          <View style={styles.trip}>
            <Ionicons name="navigate-outline" size={14} color={colors.muted} />
            <Text style={{ color: colors.muted }}>
              Moved {distance(item.distanceM)} in {duration(item.to - item.from)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  daysBar: { flexGrow: 0 },
  days: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, height: 36, justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '600' },
  mapArea: { paddingHorizontal: 16 },
  list: { padding: 16, paddingBottom: 48 },
  loading: { marginTop: 24 },
  empty: { fontSize: 15, textAlign: 'center', marginTop: 16 },
  summary: { fontSize: 14, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, minHeight: 52 },
  rail: { width: 18, alignItems: 'center' },
  node: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, marginTop: 3 },
  line: { width: 2, flex: 1, marginVertical: 2 },
  rowText: { flex: 1, paddingBottom: 14, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  trip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 1 },
});
