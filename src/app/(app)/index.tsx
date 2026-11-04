import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { MAX_MEMBERS, useMyGroups, type GroupSummary } from '@/features/groups/api';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { usePullToRefresh, useRefreshOnFocus } from '@/lib/query';
import { useColors } from '@/lib/theme';

export default function MyGroups() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const groups = useMyGroups();
  useRefreshOnFocus(groups.refetch);
  const pull = usePullToRefresh(groups.refetch);

  function renderGroup({ item }: { item: GroupSummary }) {
    const isAdmin = item.adminId === session?.user.id;
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/group/[id]', params: { id: item.id } })}
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}>
        <View style={styles.cardText}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.cardMeta, { color: colors.muted }]}>
            {item.memberCount} of {MAX_MEMBERS} members{isAdmin ? ' · You are admin' : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityLabel="Settings">
              <Ionicons name="settings-outline" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <FlatList
        data={groups.data ?? []}
        keyExtractor={(g) => g.id}
        renderItem={renderGroup}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}
        ListEmptyComponent={
          groups.isPending ? (
            <ActivityIndicator style={styles.empty} />
          ) : groups.isError ? (
            <Text style={[styles.empty, styles.emptyText, { color: colors.danger }]}>{friendlyError(groups.error)}</Text>
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No groups yet</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                Create a group and invite your friends, or join one with a code from a friend.
              </Text>
            </View>
          )
        }
      />

      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        <Button title="Create a group" onPress={() => router.push('/create-group')} />
        <Button title="Join with a code" variant="secondary" onPress={() => router.push('/join')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1, borderRadius: 14, gap: 12 },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  cardMeta: { fontSize: 14 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  actions: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
});
