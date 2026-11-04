import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Battery } from '@/components/battery';
import type { Member } from '@/features/groups/api';
import type { LivePosition } from '@/features/map/api';
import { STALE_MS } from '@/features/map/group-map';
import { type as typeStyles, useColors } from '@/lib/theme';
import { timeAgo } from '@/lib/time';

/** "2 min ago · ±8 m", "Paused", "Location is off"… for a person's row. */
export function statusLine(member: Member, position: LivePosition | undefined, now: number): string {
  if (!member.sharingEnabled) return 'Sharing paused';
  if (member.status === 'location_off') return 'Location is off';
  if (member.status === 'permission_missing') return 'Location permission missing';
  if (!position) return member.lastSeenAt ? `Last seen ${timeAgo(member.lastSeenAt, now)}` : 'No location yet';
  const ago = timeAgo(position.recordedAt, now);
  const stale = now - Date.parse(position.recordedAt) > STALE_MS;
  const accuracy = position.accuracyM != null ? ` · ±${Math.round(position.accuracyM)} m` : '';
  return stale ? `Last seen ${ago}` : `${ago[0].toUpperCase()}${ago.slice(1)}${accuracy}`;
}

type Props = {
  member: Member;
  position?: LivePosition;
  now: number;
  isYou: boolean;
  isAdmin: boolean;
  onPress?: () => void;
  /** Replaces the battery on the right (e.g. an options button). */
  trailing?: ReactNode;
};

/** A person in a list: avatar, name, live status and battery. */
export function MemberRow({ member, position, now, isYou, isAdmin, onPress, trailing }: Props) {
  const colors = useColors();
  const paused = !member.sharingEnabled;
  const right =
    trailing ??
    (paused ? (
      <View style={[styles.chip, { backgroundColor: colors.fill }]}>
        <Text style={[typeStyles.caption, { color: colors.muted, fontSize: 12 }]}>Paused</Text>
      </View>
    ) : position?.batteryPct != null ? (
      <Battery percent={position.batteryPct} />
    ) : null);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <Avatar name={member.displayName} uri={member.avatarUrl} dim={paused} />
      <View style={styles.text}>
        <Text style={[typeStyles.bodyStrong, { color: colors.text }]} numberOfLines={1}>
          {member.displayName}
          {isYou ? ' (you)' : ''}
        </Text>
        <Text style={[typeStyles.caption, { color: colors.muted }]} numberOfLines={1}>
          {isAdmin ? 'Admin · ' : ''}
          {statusLine(member, position, now)}
        </Text>
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  text: { flex: 1, gap: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
});
