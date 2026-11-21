import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Avatar } from '@/components/avatar';
import { StatTile } from '@/components/card';
import { Icon } from '@/components/icon';
import { SheetArea, SheetBackground } from '@/components/sheet-background';
import { Floating, MapButton } from '@/components/surface';
import { useMembers } from '@/features/groups/api';
import { useDayHistory, useRecentDays } from '@/features/history/api';
import { HistoryMap, type HistoryMapHandle } from '@/features/history/history-map';
import { buildTimeline, formatDistance, travelledM, type Stay, type TimelineItem } from '@/features/history/timeline';
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

export default function MemberHistory() {
  const colors = useColors();
  const darkMap = useMapIsDark();
  const focused = useIsFocused();
  const safe = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { id, userId } = useLocalSearchParams<{ id: string; userId: string }>();
  const { session } = useAuth();
  const members = useMembers(id);
  const member = members.data?.find((m) => m.userId === userId);

  const days = useRecentDays();
  // The chosen day by its date, so it stays put when the list moves on a day at midnight; null
  // follows today. A day that drops off the week falls back to today.
  const [dayKey, setDayKey] = useState<string | null>(null);
  const dayIndex = Math.max(0, days.findIndex((d) => d.start.toISOString() === dayKey));
  const history = useDayHistory(userId, days[dayIndex]);

  const points = useMemo(() => history.data ?? [], [history.data]);
  const timeline = useMemo(() => buildTimeline(points), [points]);
  const stays = useMemo(() => timeline.filter((i): i is Stay => i.kind === 'stay'), [timeline]);
  const [selected, setSelected] = useState<Stay | null>(null);
  const map = useRef<HistoryMapHandle>(null);

  const isYou = userId === session?.user.id;
  const name = member?.displayName ?? '';
  // "Their week" until the name has loaded.
  const title = isYou ? 'Your week' : name ? `${name.split(' ')[0]}'s week` : 'Their week';
  const top = safe.top + 12;
  // How tall the days and totals are, for the lowered sheet's height.
  const [peekHeight, setPeekHeight] = useState(0);

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
    setDayKey(index === 0 ? null : days[index].start.toISOString());
    setSelected(null);
  }

  function showStay(stay: Stay) {
    setSelected(stay);
    map.current?.focus(stay.lat, stay.lng);
  }

  return (
    <View style={styles.container}>
      {/* The navigation buttons sit over the map here, so they follow its brightness (a light map
          stays light in dark mode). Only while this screen is showing: screens opened over it
          follow the app's theme (root layout). The status bar does the same, set in the app
          layout. */}
      {focused && <NavigationBar style={darkMap ? 'light' : 'dark'} />}
      <HistoryMap
        ref={map}
        points={points}
        stays={stays}
        selected={selected}
        insets={{ top: top + 64, bottom: height * 0.45 }}
        frameKey={days[dayIndex].start.toISOString()}
      />

      <View style={[styles.top, { top }]}>
        <MapButton round icon="arrow_back" accessibilityLabel="Back" onPress={() => router.back()} />
        <Floating radius={24} style={styles.titlePill}>
          <Avatar name={name || '?'} uri={member?.avatarUrl} size={36} />
          <Text style={[typeStyles.bodyStrong, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        </Floating>
      </View>

      <SheetArea bottom={safe.bottom}>
        <BottomSheet
          index={1}
          // Heights in the area above Android's navigation bar.
          // Lowered, it ends just below the days and totals (measured), never through a timeline row.
          snapPoints={[
            peekHeight ? SHEET_TOP + peekHeight + PEEK_GAP : 190,
            Math.round((height - safe.bottom) * 0.5),
            height - safe.bottom - (top + 72),
          ]}
          enableDynamicSizing={false}
          backgroundComponent={SheetBackground}
          handleIndicatorStyle={{ backgroundColor: `${colors.muted}66`, width: 32, height: 4 }}>
          <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
            <View style={styles.peekPart} onLayout={(e) => setPeekHeight(Math.round(e.nativeEvent.layout.height))}>
              {/* The last seven days as one week strip: all fit across, so none is cut off at the
                  edge, and the chosen day is always in view. */}
              <View style={styles.days}>
                {days.map((d, i) => {
                  const active = i === dayIndex;
                  const weekday = d.isToday ? 'Today' : d.start.toLocaleDateString(undefined, { weekday: 'short' });
                  return (
                    <Pressable
                      key={d.start.toISOString()}
                      onPress={() => pickDay(i)}
                      accessibilityRole="button"
                      accessibilityLabel={d.start.toLocaleDateString(undefined, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                      accessibilityState={{ selected: active }}
                      android_ripple={{ color: `${colors.text}14`, borderless: false }}
                      style={[styles.day, active && { backgroundColor: colors.tonal }]}>
                      <Text
                        style={[styles.weekday, { color: active ? colors.onStrong : colors.muted }]}
                        numberOfLines={1}>
                        {weekday}
                      </Text>
                      <Text style={[typeStyles.bodyStrong, { color: active ? colors.onStrong : colors.text }]}>
                        {d.start.getDate()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Loading and empty days take the tiles' height, so the sheet doesn't jump between days. */}
              {history.isPending ? (
                <View style={styles.status}>
                  <ActivityIndicator />
                </View>
              ) : history.isError ? (
                <View style={styles.status}>
                  <Text style={[typeStyles.body, styles.padded, { color: colors.danger }]}>
                    {friendlyError(history.error)}
                  </Text>
                </View>
              ) : points.length === 0 ? (
                <View style={styles.status}>
                  <Text style={[typeStyles.body, styles.empty, { color: colors.muted }]}>
                    No locations were recorded on this day.
                  </Text>
                </View>
              ) : (
                <View style={[styles.tiles, styles.padded]}>
                  <StatTile label="Places" value={String(stays.length)} />
                  <StatTile label="Travelled" value={formatDistance(travelledM(timeline))} />
                  <StatTile label="First point" value={clock(points[0].time)} />
                </View>
              )}
            </View>

            {!history.isPending && !history.isError && points.length > 0 && (
              <>
                {/* Readings that never settled for 10 minutes and didn't go far: a real day on the
                    move shows as a trip instead. */}
                {timeline.length === 0 && (
                  <Text style={[typeStyles.body, styles.empty, { color: colors.muted }]}>
                    No stop of 10 minutes or more on this day.
                  </Text>
                )}
                <View style={styles.padded}>
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
    </View>
  );
}

/** The sheet's grabber and the content's top padding, above the days. */
const SHEET_TOP = 28;
/** How much of the gap below the totals shows when lowered (the gap is 16). */
const PEEK_GAP = 8;

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
  // Where the day began is green, as the map's start dot: the first place, or the first trip
  // when the day began on the move. A selected place is filled.
  const node = selected
    ? { bg: colors.accent, fg: colors.onAccent }
    : first
      ? { bg: colors.successFill, fg: colors.onSuccessFill }
      : !stay
        ? { bg: colors.tonal, fg: colors.onTonal }
        : { bg: colors.accentFill, fg: colors.onAccentFill };
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected } : undefined}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={styles.rail}>
        <View style={[styles.node, { backgroundColor: node.bg }]}>
          <Icon name={stay ? 'location_on' : 'commute'} size={20} filled={stay} color={node.fg} />
        </View>
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
          <>
            <Text style={[typeStyles.bodyStrong, { color: colors.text }]}>Moved {formatDistance(item.distanceM)}</Text>
            <Text style={[typeStyles.caption, { color: colors.muted }]}>
              {clock(item.from)} – {clock(item.to)} · {duration(item.to - item.from)}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  titlePill: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 6,
    paddingRight: 16,
    flexShrink: 1,
  },
  days: { flexDirection: 'row', paddingHorizontal: 12, gap: 4 },
  day: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  weekday: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  sheetContent: { paddingTop: 4, paddingBottom: 24, gap: 16 },
  peekPart: { gap: 16 },
  // As tall as a row of stat tiles.
  status: { minHeight: 66, justifyContent: 'center' },
  padded: { paddingHorizontal: 16 },
  empty: { textAlign: 'center', paddingHorizontal: 16 },
  tiles: { flexDirection: 'row', gap: 8 },
  row: { flexDirection: 'row', gap: 16 },
  rail: { width: 40, alignItems: 'center' },
  node: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, minHeight: 12 },
  rowText: { flex: 1, paddingBottom: 16, paddingTop: 0 },
});
