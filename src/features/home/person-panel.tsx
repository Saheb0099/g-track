import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { StatTile } from '@/components/card';
import type { Member } from '@/features/groups/api';
import { statusLine } from '@/features/groups/member-row';
import { recentDays, useDayHistory } from '@/features/history/api';
import { buildTimeline } from '@/features/history/timeline';
import type { LivePosition } from '@/features/map/api';
import { type as typeStyles, useColors } from '@/lib/theme';
import { timeAgoShort } from '@/lib/time';

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

type Props = {
  groupId: string;
  member: Member;
  position?: LivePosition;
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
  now,
  staleMs,
  isYou,
  following,
  onToggleFollow,
  onClose,
}: Props) {
  const colors = useColors();
  const today = useMemo(() => recentDays()[0], []);
  const history = useDayHistory(member.userId, today);

  // "Here since 9:10 AM" when today's last stay is still going on.
  const hereSince = useMemo(() => {
    const last = buildTimeline(history.data ?? []).at(-1);
    return last?.kind === 'stay' && position && Date.parse(position.recordedAt) - last.to < 15 * 60_000
      ? last.from
      : null;
  }, [history.data, position]);

  const subtitle = position
    ? hereSince
      ? `Here since ${clock(hereSince)}`
      : statusLine(member, position, now, staleMs)
    : statusLine(member, position, now, staleMs);
  const battery = position?.batteryPct;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Avatar name={member.displayName} uri={member.avatarUrl} size={58} dim={!member.sharingEnabled} />
        <View style={styles.headerText}>
          <Text style={[typeStyles.title, { color: colors.text }]} numberOfLines={1}>
            {isYou ? 'You' : member.displayName.split(' ')[0]}
          </Text>
          <Text style={[typeStyles.caption, { color: colors.muted, fontSize: 14 }]} numberOfLines={1}>
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
          <StatTile
            label="Accuracy"
            value={position.accuracyM != null ? `±${Math.round(position.accuracyM)} m` : '—'}
          />
          <StatTile
            label="Battery"
            value={battery != null ? `${battery}%` : '—'}
            valueColor={battery != null ? (battery <= 20 ? colors.warning : colors.success) : undefined}
          />
        </View>
      )}

      <View style={styles.actions}>
        <Button
          title="Today's path"
          style={styles.flex}
          onPress={() =>
            router.push({ pathname: '/group/[id]/history/[userId]', params: { id: groupId, userId: member.userId } })
          }
          icon={<Ionicons name="time-outline" size={18} color={colors.onAccent} />}
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

const styles = StyleSheet.create({
  container: { gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerText: { flex: 1, gap: 2 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', gap: 8 },
  actions: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
