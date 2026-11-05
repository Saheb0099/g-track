import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { StatTile } from '@/components/card';
import type { Member } from '@/features/groups/api';
import { statusLine } from '@/features/groups/member-row';
import { useDayHistory, useRecentDays } from '@/features/history/api';
import { buildTimeline, formatDistance, travelledM } from '@/features/history/timeline';
import { distanceMeters } from '@/features/location/rules';
import type { LivePosition } from '@/features/map/api';
import { type as typeStyles, useColors } from '@/lib/theme';
import { timeAgoShort } from '@/lib/time';

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

type Props = {
  groupId: string;
  member: Member;
  position?: LivePosition;
  /** Your own position, for "2.3 km away". */
  myPosition?: LivePosition;
  now: number;
  staleMs: number;
  isYou: boolean;
  following: boolean;
  onToggleFollow: () => void;
  onClose: () => void;
};

/** The sheet with one person selected: how fresh their location is, and quick actions. */
export function PersonPanel({
  groupId,
  member,
  position,
  myPosition,
  now,
  staleMs,
  isYou,
  following,
  onToggleFollow,
  onClose,
}: Props) {
  const colors = useColors();
  const today = useRecentDays()[0];
  const history = useDayHistory(member.userId, today);

  const timeline = useMemo(() => buildTimeline(history.data ?? []), [history.data]);
  // "Here since 9:10 AM" when today's last stay is still going on.
  const hereSince = useMemo(() => {
    const last = timeline.at(-1);
    return last?.kind === 'stay' && position && Date.parse(position.recordedAt) - last.to < 15 * 60_000
      ? last.from
      : null;
  }, [timeline, position]);

  const status = position
    ? hereSince
      ? `Here since ${clock(hereSince)}`
      : statusLine(member, position, now, staleMs)
    : statusLine(member, position, now, staleMs);
  const away = !isYou && position && myPosition ? distanceMeters(asFix(myPosition), asFix(position)) : null;
  const subtitle = away != null ? `${status} · ${awayText(away)}` : status;

  // Google Maps (or whatever handles map links) with directions to where they are now.
  const openDirections = () =>
    position && Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${position.lat},${position.lng}`);
  const battery = position?.batteryPct;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Avatar
          name={member.displayName}
          uri={member.avatarUrl}
          size={58}
          dim={!member.sharingEnabled || !!member.deletedAt}
        />
        <View style={styles.headerText}>
          <Text style={[typeStyles.title, { color: colors.text }]} numberOfLines={1}>
            {isYou ? 'You' : member.displayName.split(' ')[0]}
          </Text>
          {/* Two lines: "Here since 10:12 AM · 10 m away" doesn't fit on one. */}
          <Text style={[typeStyles.caption, { color: colors.muted, fontSize: 14 }]} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={[styles.close, { backgroundColor: colors.fill }]}>
          <Ionicons name="close" size={18} color={colors.muted} />
        </Pressable>
      </View>

      {position && (
        <View style={styles.tiles}>
          <StatTile label="Updated" value={timeAgoShort(position.recordedAt, now)} />
          {/* Distance travelled today, as on the history page. Accuracy is in the People list. */}
          <StatTile label="Today" value={history.data ? formatDistance(travelledM(timeline)) : '—'} />
          <StatTile
            label="Battery"
            value={battery != null ? `${battery}%` : '—'}
            valueColor={battery != null ? (battery <= 20 ? colors.warning : colors.success) : undefined}
          />
        </View>
      )}

      {!isYou && position && (
        <Button
          title="Directions"
          onPress={openDirections}
          icon={<Ionicons name="navigate-circle-outline" size={20} color={colors.onAccent} />}
        />
      )}

      <View style={styles.actions}>
        <Button
          title="Today's path"
          variant={!isYou && position ? 'secondary' : 'primary'}
          style={styles.flex}
          onPress={() =>
            router.push({ pathname: '/group/[id]/history/[userId]', params: { id: groupId, userId: member.userId } })
          }
          icon={<Ionicons name="time-outline" size={18} color={!isYou && position ? colors.text : colors.onAccent} />}
        />
        {position && (
          <Button
            title={following ? 'Following' : 'Follow'}
            variant={following ? 'strong' : 'secondary'}
            style={styles.flex}
            onPress={onToggleFollow}
            icon={
              <Ionicons
                name={following ? 'navigate' : 'navigate-outline'}
                size={18}
                color={following ? colors.onStrong : colors.text}
              />
            }
          />
        )}
      </View>
    </View>
  );
}

const asFix = (p: LivePosition) => ({ lat: p.lat, lng: p.lng, time: 0 });

/** "350 m away", "2.3 km away", "48 km away". */
function awayText(meters: number) {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m away`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerText: { flex: 1, gap: 2 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', gap: 8 },
  actions: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
