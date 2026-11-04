import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, RowDivider } from '@/components/card';
import { formatDeletionDate, type GroupSummary, type Member } from '@/features/groups/api';
import { MemberRow } from '@/features/groups/member-row';
import { useSharingStatus } from '@/features/location/sharing-status';
import type { LivePosition } from '@/features/map/api';
import { staleAfterMs } from '@/features/map/group-map';
import { type as typeStyles, useColors } from '@/lib/theme';

type Props = {
  group: GroupSummary;
  members: Member[];
  positions: LivePosition[];
  now: number;
  meId?: string;
  onSelect: (userId: string) => void;
};

/** The sheet when nobody is selected: who's in the group and how each phone is doing. */
export function PeoplePanel({ group, members, positions, now, meId, onSelect }: Props) {
  const colors = useColors();
  const status = useSharingStatus();
  const isAdmin = group.adminId === meId;
  const byUser = new globalThis.Map(positions.map((p) => [p.userId, p]));
  const openSettings = () => router.push({ pathname: '/group/[id]/settings', params: { id: group.id } });

  const dot = status?.tone === 'ok' ? colors.success : status?.tone === 'attention' ? colors.warning : colors.muted;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[typeStyles.heading, { color: colors.text }]}>People</Text>
          {status && (
            <Pressable
              onPress={() => router.push('/setup')}
              accessibilityRole="button"
              accessibilityHint="Opens location sharing setup"
              style={styles.status}
              hitSlop={8}>
              <View style={[styles.dot, { backgroundColor: dot }]} />
              <Text style={[typeStyles.caption, { color: colors.muted }]}>{status.label}</Text>
              {status.tone !== 'ok' && <Ionicons name="chevron-forward" size={14} color={colors.muted} />}
            </Pressable>
          )}
          {group.deletedAt && (
            <Text style={[typeStyles.caption, { color: colors.danger }]}>
              Group will be deleted on {formatDeletionDate(group.deletedAt)}
            </Text>
          )}
        </View>
        {/* Invites, members, location timing and leaving all live in the group's settings. */}
        <Button
          title="Group settings"
          size="small"
          onPress={openSettings}
          icon={<Ionicons name="settings-outline" size={17} color={colors.onAccent} />}
        />
      </View>

      <Card>
        {members.map((m, i) => (
          <Fragment key={m.userId}>
            {i > 0 && <RowDivider />}
            <MemberRow
              member={m}
              position={byUser.get(m.userId)}
              now={now}
              isYou={m.userId === meId}
              isAdmin={m.userId === group.adminId}
              staleMs={staleAfterMs(group.saveEveryMin)}
              onPress={() => onSelect(m.userId)}
            />
          </Fragment>
        ))}
      </Card>

      {members.length === 1 && isAdmin && (
        <Text style={[typeStyles.caption, styles.hint, { color: colors.muted }]}>
          {"It's just you so far. Open Group settings to share the group's invite link."}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1, gap: 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  hint: { textAlign: 'center', lineHeight: 19 },
});
