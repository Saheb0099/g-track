import { router } from 'expo-router';
import { Fragment } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Button } from '@/components/button';
import { Card, RowDivider, SectionLabel } from '@/components/card';
import { Icon } from '@/components/icon';
import { formatDeletionDate, MAX_MEMBERS, useMyGroups } from '@/features/groups/api';
import { setCurrentGroup, useCurrentGroup } from '@/features/groups/current-group';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { type as typeStyles, useColors } from '@/lib/theme';

/** Pick which group the map shows, or start a new one. */
export default function Groups() {
  // Edge-to-edge: keep the last item clear of Android's navigation bar.
  const safe = useSafeAreaInsets();
  const colors = useColors();
  const { session } = useAuth();
  const groups = useMyGroups();
  const current = useCurrentGroup(groups.data);

  function open(id: string) {
    setCurrentGroup(id);
    router.back();
  }

  return (
    <ScrollView
      // Ends at Android's navigation bar, so nothing scrolls behind its buttons.
      style={{ backgroundColor: colors.background, marginBottom: safe.bottom }}
      contentContainerStyle={[styles.container, { paddingBottom: 32 }]}>
      {groups.isPending ? (
        <ActivityIndicator />
      ) : groups.isError ? (
        <Text style={[typeStyles.body, { color: colors.danger }]}>{friendlyError(groups.error)}</Text>
      ) : groups.data.length > 0 ? (
        <View style={styles.section}>
          <SectionLabel>Groups</SectionLabel>
          <Card>
            {groups.data.map((g, i) => {
              const active = g.id === current?.id;
              return (
                <Fragment key={g.id}>
                  {i > 0 && <RowDivider inset={76} />}
                  <Pressable
                    onPress={() => open(g.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    android_ripple={{ color: `${colors.text}14` }}
                    style={[styles.row, active && { backgroundColor: colors.accentFill }]}>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: active ? colors.accent : colors.tonal,
                        },
                      ]}>
                      <Text
                        style={[
                          typeStyles.bodyStrong,
                          {
                            color: active ? colors.onAccent : colors.onTonal,
                            fontSize: 18,
                          },
                        ]}>
                        {g.name[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.flex}>
                      <Text
                        style={[typeStyles.bodyStrong, { color: active ? colors.onAccentFill : colors.text }]}
                        numberOfLines={1}>
                        {g.name}
                      </Text>
                      <Text style={[typeStyles.caption, { color: active ? colors.onAccentFill : colors.muted }]}>
                        {g.memberCount} of {MAX_MEMBERS} members
                        {g.adminId === session?.user.id ? ' · You are admin' : ''}
                        {g.deletedAt ? ` · Deleted on ${formatDeletionDate(g.deletedAt)}` : ''}
                      </Text>
                    </View>
                    {active && <Icon name="check_circle" filled color={colors.accent} />}
                  </Pressable>
                </Fragment>
              );
            })}
          </Card>
        </View>
      ) : (
        <Text style={[typeStyles.body, { color: colors.muted }]}>You aren&apos;t in any groups yet.</Text>
      )}

      <Card>
        <Pressable
          onPress={() => router.push('/join')}
          accessibilityRole="button"
          android_ripple={{ color: `${colors.text}14` }}
          style={styles.row}>
          <View style={[styles.badge, styles.round, { backgroundColor: colors.tonal }]}>
            <Icon name="key" color={colors.onTonal} />
          </View>
          <View style={styles.flex}>
            <Text style={[typeStyles.bodyStrong, { color: colors.text }]}>Join with a code</Text>
            <Text style={[typeStyles.caption, { color: colors.muted }]}>A friend shares their group&apos;s code</Text>
          </View>
          <Icon name="chevron_right" color={colors.muted} />
        </Pressable>
      </Card>
      <Button title="Create a group" icon="add" onPress={() => router.push('/create-group')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16, paddingBottom: 48 },
  section: { gap: 8 },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  round: { borderRadius: 22 },
  flex: { flex: 1 },
});
