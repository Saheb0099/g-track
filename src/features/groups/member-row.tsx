import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import type { Member } from '@/features/groups/api';
import { useColors } from '@/lib/theme';
import { timeAgo } from '@/lib/time';

function statusLine(member: Member): string {
  if (!member.sharingEnabled) return 'Sharing paused';
  if (member.status === 'location_off') return 'Location is off';
  if (member.status === 'permission_missing') return 'Location permission missing';
  if (!member.lastSeenAt) return 'No location yet';
  return `Updated ${timeAgo(member.lastSeenAt)}`;
}

type Props = { member: Member; isAdmin: boolean; isYou: boolean; action?: ReactNode };

export function MemberRow({ member, isAdmin, isYou, action }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Avatar name={member.displayName} uri={member.avatarUrl} />
      <View style={styles.text}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {member.displayName}
          {isYou ? ' (you)' : ''}
        </Text>
        <Text style={[styles.status, { color: colors.muted }]} numberOfLines={1}>
          {isAdmin ? 'Admin · ' : ''}
          {statusLine(member)}
        </Text>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600' },
  status: { fontSize: 14 },
});
