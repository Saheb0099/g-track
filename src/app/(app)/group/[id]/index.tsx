import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { useGroup, useMembers } from '@/features/groups/api';
import { MemberRow } from '@/features/groups/member-row';
import { useLivePositions } from '@/features/map/api';
import { GroupMap, type GroupMapHandle } from '@/features/map/group-map';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { usePullToRefresh, useRefreshOnFocus } from '@/lib/query';
import { useColors } from '@/lib/theme';

/** "Updated 3 min ago" labels and faded markers are recomputed this often. */
const CLOCK_TICK_MS = 30_000;

export default function GroupScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const group = useGroup(id);
  const members = useMembers(id);
  const live = useLivePositions(id, members.data?.map((m) => m.userId) ?? []);
  const map = useRef<GroupMapHandle>(null);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const { refetch: refetchGroup } = group;
  const { refetch: refetchMembers } = members;
  const { refetch: refetchLive } = live;
  const refetchAll = useCallback(
    () => Promise.all([refetchGroup(), refetchMembers(), refetchLive()]),
    [refetchGroup, refetchMembers, refetchLive],
  );
  useRefreshOnFocus(refetchAll);
  const pull = usePullToRefresh(refetchAll);

  const openSettings = () => router.push({ pathname: '/group/[id]/settings', params: { id } });
  const isAdmin = group.data?.adminId === session?.user.id;

  if (group.isPending) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }
  if (group.isError || !group.data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {group.isError ? "Couldn't load this group" : "You're not in this group any more"}
        </Text>
        {group.isError && <Text style={{ color: colors.muted }}>{friendlyError(group.error)}</Text>}
        <Button title="Back to my groups" variant="secondary" onPress={() => router.dismissTo('/')} />
      </View>
    );
  }

  const adminId = group.data.adminId;
  const alone = members.data?.length === 1;
  const sharing = new Set((live.data ?? []).map((p) => p.userId));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: group.data.name,
          headerRight: () => (
            <Pressable onPress={openSettings} hitSlop={12} accessibilityLabel="Group settings">
              <Ionicons name="settings-outline" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      {/* Fixed above the list, so dragging the map never scrolls the list. */}
      <View style={styles.mapArea}>
        <GroupMap ref={map} positions={live.data ?? []} members={members.data ?? []} now={now} />
      </View>

      <FlatList
        data={members.data ?? []}
        keyExtractor={(m) => m.userId}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            {isAdmin && alone && (
              <View style={[styles.invite, { borderColor: colors.border }]}>
                <Text style={[styles.inviteTitle, { color: colors.text }]}>Invite your friends</Text>
                <Text style={{ color: colors.muted }}>{"Share the group's join code so others can join."}</Text>
                <Button title="Invite friends" onPress={openSettings} />
              </View>
            )}
            <Text style={[styles.section, { color: colors.muted }]}>
              MEMBERS{members.data ? ` · ${members.data.length}` : ''}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => map.current?.focus(item.userId)}
            disabled={!sharing.has(item.userId)}
            accessibilityRole="button"
            accessibilityHint="Shows this person on the map"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <MemberRow
              member={item}
              isAdmin={item.userId === adminId}
              isYou={item.userId === session?.user.id}
              action={
                // History stays visible while someone has sharing paused, so this is always offered.
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/group/[id]/history/[userId]', params: { id, userId: item.userId } })
                  }
                  hitSlop={12}
                  accessibilityLabel={`${item.displayName}'s history`}
                  style={[styles.historyButton, { borderColor: colors.border }]}>
                  <Ionicons name="time-outline" size={18} color={colors.text} />
                </Pressable>
              }
            />
          </Pressable>
        )}
        ListEmptyComponent={
          members.isPending ? (
            <ActivityIndicator />
          ) : members.isError ? (
            <Text style={{ color: colors.danger }}>{friendlyError(members.error)}</Text>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  mapArea: { paddingHorizontal: 16, paddingTop: 12 },
  list: { padding: 16 },
  header: { gap: 16, marginBottom: 4 },
  invite: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  inviteTitle: { fontSize: 17, fontWeight: '700' },
  section: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  historyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
