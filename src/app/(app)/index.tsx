import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { SheetArea, SheetBackground } from '@/components/sheet-background';
import { CompassNeedle, Floating, MapButton } from '@/components/surface';
import { MAX_MEMBERS, useMembers, useMyGroups } from '@/features/groups/api';
import { useCurrentGroup } from '@/features/groups/current-group';
import { takePendingInvite } from '@/features/groups/pending-invite';
import { PeoplePanel } from '@/features/home/people-panel';
import { PersonPanel } from '@/features/home/person-panel';
import { useLivePositions } from '@/features/map/api';
import { GroupMap, staleAfterMs, type GroupMapHandle } from '@/features/map/group-map';
import { useMapIsDark } from '@/features/map/styles';
import { useMyProfile } from '@/features/profile/api';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { useRefreshOnFocus } from '@/lib/query';
import { type as typeStyles, useColors } from '@/lib/theme';

/** "Updated 3 min ago" labels and faded markers are recomputed this often. */
const CLOCK_TICK_MS = 30_000;
/** Smallest sheet height (above the navigation bar): the people header and a row, or a person's details. */
const PEOPLE_PEEK = 200;
const PERSON_PEEK = 230;
/** The sheet's grabber and the content's top padding, above the panel. */
const SHEET_TOP = 28;
/** How much of the gap below a lowered person's details shows (the gap is 12). */
const PEEK_GAP = 8;
/** The my-location button floats this far above the sheet's top edge. */
const FAB_ABOVE_SHEET = 72;

export default function Home() {
  const colors = useColors();
  const darkMap = useMapIsDark();
  const focused = useIsFocused();
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
  // Where the sheet's top edge is, so the my-location button can ride just above it.
  const sheetTop = useSharedValue(height);
  // Selection and following belong to a group; switching groups leaves them behind.
  const groupId = group?.id;
  const [selection, setSelection] = useState<{ groupId?: string; userId: string | null }>({ userId: null });
  const [following, setFollowing] = useState<{ groupId?: string; userId: string | null }>({ userId: null });
  const selectedId = selection.groupId === groupId ? selection.userId : null;
  const followId = following.groupId === groupId ? following.userId : null;
  const setSelectedId = (userId: string | null) => setSelection({ groupId, userId });
  const setFollowId = (userId: string | null) => setFollowing({ groupId, userId });

  const [now, setNow] = useState(() => Date.now());
  // How tall the selected person's details are, for the lowered sheet's height.
  const [peek, setPeek] = useState<{ userId?: string; height: number }>({ height: 0 });
  // The map's rotation and tilt, so the compass needle keeps pointing north.
  const [turn, setTurn] = useState({ bearing: 0, tilted: false });
  const northUp = turn.bearing === 0 && !turn.tilted;
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
  // Someone who stopped sharing with this group stays visible through another group you share,
  // but isn't drawn here. Your own pin always shows, as it does while you're paused.
  const hiddenHere = new Set(members.data?.filter((m) => m.hiddenAt && m.userId !== meId).map((m) => m.userId));
  const positions = (live.data ?? []).filter((p) => !hiddenHere.has(p.userId));
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
  const staleMs = staleAfterMs(group?.saveEveryMin ?? 5);
  // "2.3 km away" needs to know where you are now: not while you're paused, or if your own
  // position is old (it would measure from where you were).
  const mine = positions.find((p) => p.userId === meId);
  const myPosition =
    profile.data?.sharing_enabled && mine && now - Date.parse(mine.recordedAt) <= staleMs ? mine : undefined;
  // Your own pin always shows, but you count as sharing only while you share with this group.
  const meSharingHere =
    !!profile.data?.sharing_enabled && !members.data?.find((m) => m.userId === meId)?.hiddenAt;
  const sharingCount = positions.filter((p) => p.userId !== meId || meSharingHere).length;
  const topBar = safe.top + 12;
  // Sheet heights, measured in the area above Android's navigation bar. The person view needs
  // more room than the people list; fully open stops just under the top bar.
  const sheetArea = height - safe.bottom;
  // Lowered, a person's sheet ends just below their details, measured, before Today's path.
  const personPeek = peek.userId === selected?.userId && peek.height ? SHEET_TOP + peek.height + PEEK_GAP : PERSON_PEEK;
  const snapPoints = [selected ? personPeek : PEOPLE_PEEK, Math.round(sheetArea * 0.52), sheetArea - (topBar + 64)];
  const mapInsets = { top: topBar + 56, bottom: height * 0.45 };
  // Hidden once the sheet is pulled up close to the top bar. Moved off screen, not just made
  // clear, so it can't catch taps meant for the top bar or the map buttons under it.
  const fabStyle = useAnimatedStyle(() => {
    const top = sheetTop.get();
    const hidden = top < topBar + 200;
    return {
      opacity: hidden ? 0 : 1,
      transform: [{ translateY: hidden ? -1000 : top - FAB_ABOVE_SHEET }],
    };
  });

  // Android Back steps back through what's open, like other apps: the person view first,
  // then a fully open sheet, and only then leaves the app.
  const sheetIndex = useRef(1);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (selection.userId && selection.groupId === groupId) {
          setSelection({ groupId, userId: null });
          setFollowing({ groupId, userId: null });
          return true;
        }
        if (sheetIndex.current > 1) {
          sheet.current?.snapToIndex(1);
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [selection, groupId]),
  );

  return (
    <View style={styles.container}>
      {/* The navigation buttons sit over the map here, so they follow its brightness (a light map
          stays light in dark mode). Only while this screen is showing: screens opened over it
          follow the app's theme (root layout). The status bar does the same, set in the app
          layout. */}
      {focused && <NavigationBar style={darkMap ? 'light' : 'dark'} />}
      <GroupMap
        ref={map}
        positions={positions}
        members={members.data ?? []}
        now={now}
        meId={meId}
        selectedId={selectedId}
        onSelect={select}
        insets={mapInsets}
        staleMs={staleMs}
        frameKey={groupId ?? 'solo'}
        onTurn={setTurn}
      />

      {/* Group switcher and profile, shaped like a search bar */}
      <Floating radius={28} style={[styles.topBar, { top: topBar }]}>
        <Pressable
          onPress={() => router.push('/groups')}
          accessibilityRole="button"
          accessibilityLabel={group ? `Switch group, current group ${group.name}` : 'Your groups'}
          style={({ pressed }) => [styles.groupButton, { opacity: pressed ? 0.7 : 1 }]}>
          <View style={[styles.groupBadge, { backgroundColor: colors.accent }]}>
            <Text style={[typeStyles.bodyStrong, { color: colors.onAccent, fontSize: 17 }]}>
              {(group?.name ?? 'G')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text style={[typeStyles.bodyStrong, { color: colors.text, lineHeight: 22 }]} numberOfLines={1}>
              {group?.name ?? 'G Track'}
            </Text>
            <Text style={[typeStyles.caption, { color: colors.muted, fontSize: 12, lineHeight: 16 }]} numberOfLines={1}>
              {group
                ? `${sharingCount} of ${group.memberCount} sharing`
                : groups.isPending
                  ? 'Loading…'
                  : 'No group yet'}
            </Text>
          </View>
          <Icon name="arrow_drop_down" color={colors.muted} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Your settings"
          hitSlop={4}
          style={({ pressed }) => [styles.profile, { opacity: pressed ? 0.7 : 1 }]}>
          <Avatar name={profile.data?.display_name ?? '?'} uri={profile.data?.avatar_url} size={34} />
        </Pressable>
      </Floating>

      {/* Map controls */}
      <View style={[styles.controls, { top: topBar + 72 }]}>
        <MapButton icon="layers" accessibilityLabel="Map style" onPress={() => router.push('/map-style')} />
        <MapButton icon="groups" accessibilityLabel="Show everyone" onPress={() => map.current?.showEveryone()} />
        {/* The needle points north as the map turns; tapping turns the map back to north-up and flat. */}
        <MapButton
          icon="navigation"
          accessibilityLabel={northUp ? 'Map faces north' : 'Turn map to face north'}
          onPress={() => map.current?.faceNorth()}>
          <CompassNeedle bearing={turn.bearing} northUp={northUp} />
        </MapButton>
      </View>
      <Animated.View style={[styles.fab, fabStyle]} pointerEvents="box-none">
        <MapButton
          primary
          icon="my_location"
          accessibilityLabel="Go to my location"
          onPress={() => meId && select(meId)}
        />
      </Animated.View>

      <SheetArea bottom={safe.bottom}>
        <BottomSheet
          ref={sheet}
          index={1}
          snapPoints={snapPoints}
          enableDynamicSizing={false}
          animatedPosition={sheetTop}
          onChange={(index) => {
            sheetIndex.current = index;
          }}
          backgroundComponent={SheetBackground}
          handleIndicatorStyle={{ backgroundColor: `${colors.muted}66`, width: 32, height: 4 }}>
          <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
            {groups.isPending ? (
              <ActivityIndicator style={styles.loading} />
            ) : groups.isError ? (
              <Text style={[typeStyles.body, { color: colors.danger }]}>{friendlyError(groups.error)}</Text>
            ) : !group ? (
              <Welcome />
            ) : selected ? (
              <PersonPanel
                // A fresh panel per person, so an ask in progress doesn't carry over to someone else.
                key={selected.userId}
                groupId={group.id}
                member={selected}
                position={positions.find((p) => p.userId === selected.userId)}
                myPosition={myPosition}
                now={now}
                staleMs={staleMs}
                isYou={selected.userId === meId}
                following={followId === selected.userId}
                onToggleFollow={() => setFollowId(followId === selected.userId ? null : selected.userId)}
                onClose={() => select(null)}
                onFreshLocation={() => map.current?.focus(selected.userId)}
                onPeekHeight={(height) => setPeek({ userId: selected.userId, height: Math.round(height) })}
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
      </SheetArea>
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
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 4,
  },
  groupButton: { flex: 1, height: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupBadge: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  profile: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  controls: { position: 'absolute', right: 16, gap: 12 },
  fab: { position: 'absolute', right: 16, top: 0 },
  sheetContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  loading: { marginTop: 24 },
  welcome: { gap: 12 },
});
