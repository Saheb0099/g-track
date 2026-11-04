import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView, type BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import { BlurTargetView } from 'expo-blur';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Glass, GlassTarget } from '@/components/glass';
import { GlassButton } from '@/components/glass-button';
import { MAX_MEMBERS, useMembers, useMyGroups } from '@/features/groups/api';
import { useCurrentGroup } from '@/features/groups/current-group';
import { takePendingInvite } from '@/features/groups/pending-invite';
import { PeoplePanel } from '@/features/home/people-panel';
import { PersonPanel } from '@/features/home/person-panel';
import { useLivePositions } from '@/features/map/api';
import { GroupMap, type GroupMapHandle } from '@/features/map/group-map';
import { useMyProfile } from '@/features/profile/api';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { useRefreshOnFocus } from '@/lib/query';
import { radius, type as typeStyles, useColors } from '@/lib/theme';

/** "Updated 3 min ago" labels and faded markers are recomputed this often. */
const CLOCK_TICK_MS = 30_000;
const SHEET_PEEK = 200;

function SheetBackground({ style }: BottomSheetBackgroundProps) {
  return <Glass radius={radius.sheet} style={[style, styles.sheetShadow]} />;
}

export default function Home() {
  const colors = useColors();
  const dark = useColorScheme() === 'dark';
  const safe = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { session } = useAuth();
  const meId = session?.user.id;

  const groups = useMyGroups();
  const group = useCurrentGroup(groups.data);
  const members = useMembers(group?.id ?? 'none');
  const memberIds = group ? (members.data?.map((m) => m.userId) ?? []) : meId ? [meId] : [];
  const live = useLivePositions(group?.id ?? 'solo', memberIds);
  const profile = useMyProfile();

  const { refetch: refetchGroups } = groups;
  useRefreshOnFocus(refetchGroups);

  const map = useRef<GroupMapHandle>(null);
  const sheet = useRef<BottomSheet>(null);
  const blurTarget = useRef<ComponentRef<typeof View>>(null);
  // Selection and following belong to a group; switching groups leaves them behind.
  const groupId = group?.id;
  const [selection, setSelection] = useState<{ groupId?: string; userId: string | null }>({ userId: null });
  const [following, setFollowing] = useState<{ groupId?: string; userId: string | null }>({ userId: null });
  const selectedId = selection.groupId === groupId ? selection.userId : null;
  const followId = following.groupId === groupId ? following.userId : null;
  const setSelectedId = (userId: string | null) => setSelection({ groupId, userId });
  const setFollowId = (userId: string | null) => setFollowing({ groupId, userId });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Finish an invite link that was opened before signing in.
  useEffect(() => {
    const code = takePendingInvite();
    if (code) router.push({ pathname: '/join/[code]', params: { code } });
  }, []);

  // Following keeps the map on that person as their new positions arrive.
  const positions = live.data ?? [];
  const followed = positions.find((p) => p.userId === followId);
  useEffect(() => {
    if (followId) map.current?.follow(followId);
  }, [followId, followed?.recordedAt, followed?.lat, followed?.lng]);

  function select(userId: string | null) {
    setSelectedId(userId);
    if (userId !== followId) setFollowId(null);
    if (userId) {
      map.current?.focus(userId);
      // Half height: enough for the person's tiles and buttons, with them still on the map above.
      sheet.current?.snapToIndex(1);
    }
  }

  const selected = members.data?.find((m) => m.userId === selectedId);
  const topBar = safe.top + 12;
  const mapInsets = { top: topBar + 56, bottom: Math.max(SHEET_PEEK, height * 0.42) };

  return (
    <View style={styles.container}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <BlurTargetView ref={blurTarget} style={StyleSheet.absoluteFill}>
        <GroupMap
          ref={map}
          positions={positions}
          members={members.data ?? []}
          now={now}
          meId={meId}
          selectedId={selectedId}
          onSelect={select}
          insets={mapInsets}
        />
      </BlurTargetView>

      <GlassTarget.Provider value={blurTarget}>
        {/* Group switcher and profile */}
        <View style={[styles.topBar, { top: topBar }]}>
          <Pressable
            onPress={() => router.push('/groups')}
            accessibilityRole="button"
            accessibilityLabel={group ? `Switch group, current group ${group.name}` : 'Your groups'}
            style={({ pressed }) => [styles.flex, { opacity: pressed ? 0.75 : 1 }]}>
            <Glass radius={26} floating style={styles.groupPill}>
              <View style={[styles.groupBadge, { backgroundColor: colors.accent }]}>
                <Text style={[typeStyles.bodyStrong, { color: colors.onAccent, fontSize: 14 }]}>
                  {(group?.name ?? 'G')[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.flex}>
                <Text style={[typeStyles.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                  {group?.name ?? 'G Track'}
                </Text>
                <Text style={[typeStyles.caption, { color: colors.muted, fontSize: 12 }]} numberOfLines={1}>
                  {group
                    ? `${positions.length} of ${group.memberCount} sharing`
                    : groups.isPending
                      ? 'Loading…'
                      : 'No group yet'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={colors.muted} />
            </Glass>
          </Pressable>
          <GlassButton onPress={() => router.push('/settings')} accessibilityLabel="Your settings" size={52}>
            <Avatar name={profile.data?.display_name ?? '?'} uri={profile.data?.avatar_url} size={38} />
          </GlassButton>
        </View>

        {/* Map controls */}
        <View style={[styles.controls, { top: topBar + 72 }]}>
          <Glass radius={24} floating>
            <Pressable
              onPress={() => map.current?.showEveryone()}
              accessibilityRole="button"
              accessibilityLabel="Show everyone"
              style={styles.control}>
              <Ionicons name="people-outline" size={22} color={colors.text} />
            </Pressable>
            <View style={[styles.controlDivider, { backgroundColor: colors.border }]} />
            <Pressable
              onPress={() => meId && select(meId)}
              accessibilityRole="button"
              accessibilityLabel="Go to my location"
              style={styles.control}>
              <Ionicons name="navigate" size={20} color={colors.accent} />
            </Pressable>
          </Glass>
        </View>

        <BottomSheet
          ref={sheet}
          index={1}
          // The sheet runs under Android's navigation bar; each height adds the bar so content clears it.
          snapPoints={[SHEET_PEEK + safe.bottom, '52%', '88%']}
          enableDynamicSizing={false}
          backgroundComponent={SheetBackground}
          handleIndicatorStyle={{ backgroundColor: colors.fill, width: 40, height: 5 }}
          style={styles.sheet}>
          <BottomSheetScrollView contentContainerStyle={[styles.sheetContent, { paddingBottom: safe.bottom + 24 }]}>
            {groups.isPending ? (
              <ActivityIndicator style={styles.loading} />
            ) : groups.isError ? (
              <Text style={[typeStyles.body, { color: colors.danger }]}>{friendlyError(groups.error)}</Text>
            ) : !group ? (
              <Welcome />
            ) : selected ? (
              <PersonPanel
                groupId={group.id}
                member={selected}
                position={positions.find((p) => p.userId === selected.userId)}
                now={now}
                isYou={selected.userId === meId}
                following={followId === selected.userId}
                onToggleFollow={() => setFollowId(followId === selected.userId ? null : selected.userId)}
                onClose={() => select(null)}
              />
            ) : (
              <PeoplePanel
                group={group}
                members={members.data ?? []}
                positions={positions}
                now={now}
                meId={meId}
                onSelect={select}
              />
            )}
          </BottomSheetScrollView>
        </BottomSheet>
      </GlassTarget.Provider>
    </View>
  );
}

/** First run: no group yet. */
function Welcome() {
  const colors = useColors();
  return (
    <View style={styles.welcome}>
      <Text style={[typeStyles.heading, { color: colors.text }]}>Your friends, on one map</Text>
      <Text style={[typeStyles.body, { color: colors.muted }]}>
        Create a group and invite up to {MAX_MEMBERS - 1} friends, or join a friend&apos;s group with their code.
      </Text>
      <Button title="Create a group" onPress={() => router.push('/create-group')} />
      <Button title="Join with a code" variant="secondary" onPress={() => router.push('/join')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupPill: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  groupBadge: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  controls: { position: 'absolute', right: 16 },
  control: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  controlDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 10 },
  sheet: { marginHorizontal: 6 },
  sheetShadow: {
    shadowColor: '#0E1116',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  sheetContent: { paddingHorizontal: 18, paddingTop: 4 },
  loading: { marginTop: 24 },
  welcome: { gap: 12 },
});
