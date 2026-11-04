import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BlurTargetView } from 'expo-blur';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { StatTile } from '@/components/card';
import { Glass, GlassTarget } from '@/components/glass';
import { GlassButton } from '@/components/glass-button';
import { SheetArea, SheetBackground } from '@/components/sheet-background';
import { useMembers } from '@/features/groups/api';
import { useDayHistory, useRecentDays } from '@/features/history/api';
import { HistoryMap, type HistoryMapHandle } from '@/features/history/history-map';
import { buildTimeline, travelledM, type Stay, type TimelineItem } from '@/features/history/timeline';
import { useMapIsDark } from '@/features/map/styles';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { fonts, type as typeStyles, useColors } from '@/lib/theme';

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function duration(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`;
}

const distance = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export default function MemberHistory() {
  const colors = useColors();
  const darkMap = useMapIsDark();
  const safe = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { id, userId } = useLocalSearchParams<{ id: string; userId: string }>();
  const { session } = useAuth();
  const members = useMembers(id);
  const member = members.data?.find((m) => m.userId === userId);

  const days = useRecentDays();
  const [dayIndex, setDayIndex] = useState(0);
  const history = useDayHistory(userId, days[dayIndex]);

  const points = useMemo(() => history.data ?? [], [history.data]);
  const timeline = useMemo(() => buildTimeline(points), [points]);
  const stays = useMemo(() => timeline.filter((i): i is Stay => i.kind === 'stay'), [timeline]);
  const [selected, setSelected] = useState<Stay | null>(null);
  const map = useRef<HistoryMapHandle>(null);
  const blurTarget = useRef<ComponentRef<typeof View>>(null);

  const isYou = userId === session?.user.id;
  const name = member?.displayName ?? '';
  const title = isYou ? 'Your week' : `${name.split(' ')[0] || 'Their'}'s week`;
  const top = safe.top + 12;
  const sheetBottom = safe.bottom + 8;
  const sheetArea = height - sheetBottom;

  // Android Back clears a selected place first, then goes back to the map.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!selected) return false;
        setSelected(null);
        return true;
      });
      return () => sub.remove();
    }, [selected, setSelected]),
  );

  function pickDay(index: number) {
    setDayIndex(index);
    setSelected(null);
  }

  function showStay(stay: Stay) {
    setSelected(stay);
    map.current?.focus(stay.lat, stay.lng);
  }

  return (
    <View style={styles.container}>
      <StatusBar style={darkMap ? 'light' : 'dark'} />
      <BlurTargetView ref={blurTarget} style={StyleSheet.absoluteFill}>
        <HistoryMap
          ref={map}
          points={points}
          stays={stays}
          selected={selected}
          insets={{ top: top + 110, bottom: height * 0.42 }}
          frameKey={days[dayIndex].start.toISOString()}
        />
      </BlurTargetView>

      <GlassTarget.Provider value={blurTarget}>
        <View style={[styles.top, { top }]}>
          <View style={styles.titleRow}>
            <GlassButton onPress={() => router.back()} accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </GlassButton>
            <Glass radius={24} floating style={styles.titlePill}>
              <Avatar name={name || '?'} uri={member?.avatarUrl} size={28} />
              <Text style={[typeStyles.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                {title}
              </Text>
            </Glass>
          </View>

          <Glass radius={24} floating style={styles.daysGlass}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              // flexGrow 0: a horizontal ScrollView otherwise stretches to the full height available.
              style={styles.daysScroll}
              contentContainerStyle={styles.days}>
              {days.map((d, i) => {
                const active = i === dayIndex;
                return (
                  <Pressable
                    key={d.start.toISOString()}
                    onPress={() => pickDay(i)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.day, active && { backgroundColor: colors.strong }]}>
                    <Text style={[styles.dayText, { color: active ? colors.onStrong : colors.text }]}>{d.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Glass>
        </View>

        <SheetArea bottom={sheetBottom}>
          <BottomSheet
            index={1}
            // The sheet runs under Android's navigation bar; each height adds the bar so content clears it.
            snapPoints={[170, Math.round(sheetArea * 0.45), sheetArea - (top + 120)]}
            enableDynamicSizing={false}
            backgroundComponent={SheetBackground}
            handleIndicatorStyle={{ backgroundColor: colors.fill, width: 40, height: 5 }}>
            <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
              {history.isPending ? (
                <ActivityIndicator style={styles.loading} />
              ) : history.isError ? (
                <Text style={[typeStyles.body, { color: colors.danger }]}>{friendlyError(history.error)}</Text>
              ) : points.length === 0 ? (
                <Text style={[typeStyles.body, styles.empty, { color: colors.muted }]}>
                  No locations were recorded on this day.
                </Text>
              ) : (
                <>
                  <View style={styles.tiles}>
                    <StatTile label="places" value={String(stays.length)} />
                    <StatTile label="travelled" value={distance(travelledM(timeline))} />
                    <StatTile label="first point" value={clock(points[0].time)} />
                  </View>
                  {timeline.length === 0 && (
                    <Text style={[typeStyles.body, styles.empty, { color: colors.muted }]}>
                      On the move all day, with no stop of 10 minutes or more.
                    </Text>
                  )}
                  <View>
                    {timeline.map((item, i) => (
                      <TimelineRow
                        key={`${item.kind}-${item.from}`}
                        item={item}
                        index={stays.indexOf(item as Stay) + 1}
                        first={i === 0}
                        last={i === timeline.length - 1}
                        selected={item === selected}
                        onPress={item.kind === 'stay' ? () => showStay(item) : undefined}
                      />
                    ))}
                  </View>
                </>
              )}
            </BottomSheetScrollView>
          </BottomSheet>
        </SheetArea>
      </GlassTarget.Provider>
    </View>
  );
}

function TimelineRow({
  item,
  index,
  first,
  last,
  selected,
  onPress,
}: {
  item: TimelineItem;
  index: number;
  first: boolean;
  last: boolean;
  selected: boolean;
  onPress?: () => void;
}) {
  const colors = useColors();
  const stay = item.kind === 'stay';
  const nodeColor = first ? colors.success : colors.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={styles.rail}>
        {stay ? (
          <View
            style={[styles.node, { borderColor: nodeColor, backgroundColor: selected ? nodeColor : 'transparent' }]}
          />
        ) : (
          <View style={[styles.tripNode, { backgroundColor: colors.muted }]} />
        )}
        {!last && <View style={[styles.line, { backgroundColor: colors.border }]} />}
      </View>
      <View style={styles.rowText}>
        {stay ? (
          <>
            <Text style={[typeStyles.bodyStrong, { color: colors.text }]}>
              Place {index} · {duration(item.to - item.from)}
            </Text>
            <Text style={[typeStyles.caption, { color: colors.muted }]}>
              {clock(item.from)} – {clock(item.to)}
            </Text>
          </>
        ) : (
          <View style={styles.trip}>
            <Ionicons name="navigate" size={13} color={colors.muted} />
            <Text style={[typeStyles.caption, { color: colors.muted, fontSize: 14 }]}>
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
  top: { position: 'absolute', left: 16, right: 16, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titlePill: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, flexShrink: 1 },
  daysGlass: { alignSelf: 'flex-start', maxWidth: '100%' },
  daysScroll: { flexGrow: 0 },
  days: { padding: 5, gap: 4 },
  day: { height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center' },
  dayText: { fontFamily: fonts.semibold, fontSize: 14 },
  sheetContent: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 24, gap: 16 },
  loading: { marginTop: 24 },
  empty: { textAlign: 'center', marginTop: 8 },
  tiles: { flexDirection: 'row', gap: 8 },
  row: { flexDirection: 'row', gap: 12, minHeight: 54 },
  rail: { width: 18, alignItems: 'center' },
  node: { width: 16, height: 16, borderRadius: 8, borderWidth: 4, marginTop: 3 },
  tripNode: { width: 8, height: 8, borderRadius: 4, marginTop: 6, opacity: 0.5 },
  line: { width: 2, flex: 1, marginVertical: 3 },
  rowText: { flex: 1, paddingBottom: 14, gap: 2 },
  trip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 1 },
});
