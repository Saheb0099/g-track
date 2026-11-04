import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { useGroup, useMembers } from '@/features/groups/api';
import { MemberRow } from '@/features/groups/member-row';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { usePullToRefresh, useRefreshOnFocus } from '@/lib/query';
import { useColors } from '@/lib/theme';

export default function GroupScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const group = useGroup(id);
  const members = useMembers(id);

  const { refetch: refetchGroup } = group;
  const { refetch: refetchMembers } = members;
  const refetchAll = useCallback(
    () => Promise.all([refetchGroup(), refetchMembers()]),
    [refetchGroup, refetchMembers],
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

      <FlatList
        data={members.data ?? []}
        keyExtractor={(m) => m.userId}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.mapPlaceholder, { borderColor: colors.border }]}>
              <Ionicons name="map-outline" size={28} color={colors.muted} />
              <Text style={{ color: colors.muted }}>The live map will appear here.</Text>
            </View>
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
          <MemberRow member={item} isAdmin={item.userId === adminId} isYou={item.userId === session?.user.id} />
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
  list: { padding: 16 },
  header: { gap: 16, marginBottom: 4 },
  mapPlaceholder: {
    height: 180,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  invite: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  inviteTitle: { fontSize: 17, fontWeight: '700' },
  section: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
});
