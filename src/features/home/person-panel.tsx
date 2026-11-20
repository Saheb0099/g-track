import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card, StatTile } from '@/components/card';
import { batteryIcon, Icon } from '@/components/icon';
import { IconButton } from '@/components/surface';
import type { Member } from '@/features/groups/api';
import { statusLine } from '@/features/groups/member-row';
import { useDayHistory, useRecentDays } from '@/features/history/api';
import { ASK_AGAIN_MS, countdown, useAskForLocation } from '@/features/home/ask-location';
import { buildTimeline, formatDistance, travelledM } from '@/features/history/timeline';
import { distanceMeters } from '@/features/location/rules';
import type { LivePosition } from '@/features/map/api';
import { openLink } from '@/lib/links';
import { type as typeStyles, useColors } from '@/lib/theme';
import { timeAgoShort } from '@/lib/time';

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

type Props = {
  groupId: string;
  member: Member;
  position?: LivePosition;
  /** Your own position, for "2.3 km away". */
  myPosition?: LivePosition;
  now: number;
  staleMs: number;
  isYou: boolean;
  following: boolean;
  onToggleFollow: () => void;
  onClose: () => void;
  /** Their phone answered "Get location now": show them on the map. */
  onFreshLocation: () => void;
  /** Height of the part shown when the sheet is lowered (everything above Today's path). */
  onPeekHeight?: (height: number) => void;
};

/** The sheet with one person selected: how fresh their location is, and quick actions. */
export function PersonPanel({
  groupId,
  member,
  position,
  myPosition,
  now,
  staleMs,
  isYou,
  following,
  onToggleFollow,
  onClose,
  onFreshLocation,
  onPeekHeight,
}: Props) {
  const colors = useColors();
  const ask = useAskForLocation(member, position, onFreshLocation);
  // Only people whose live position you may see in this group can be asked. The server checks
  // sharing too, but lets an ask through for someone hidden here who's visible through another
  // group; their answer wouldn't show here. Not when their location is off or not allowed
  // either: their phone would wake but couldn't answer, and the status line already says why.
  const canAsk =
    !isYou &&
    member.sharingEnabled &&
    !member.deletedAt &&
    !member.hiddenAt &&
    member.status !== 'location_off' &&
    member.status !== 'permission_missing';
  const asking = ask.phase === 'asking';
  const answered = ask.phase === 'done';
  // After asking, the button counts down to when they can be asked again (the server's 2 minutes).
  const waiting = !asking && !answered && ask.waitMs > 0;
  const today = useRecentDays()[0];
  const history = useDayHistory(member.userId, today);

  const timeline = useMemo(() => buildTimeline(history.data ?? []), [history.data]);
  // "Here since 9:10 AM" when today's last stay is still going on.
  const hereSince = useMemo(() => {
    const last = timeline.at(-1);
    return last?.kind === 'stay' && position && Date.parse(position.recordedAt) - last.to < 15 * 60_000
      ? last.from
      : null;
  }, [timeline, position]);

  const status = position
    ? hereSince
      ? `Here since ${clock(hereSince)}`
      : statusLine(member, position, now, staleMs)
    : statusLine(member, position, now, staleMs);
  const away = !isYou && position && myPosition ? distanceMeters(asFix(myPosition), asFix(position)) : null;
  const subtitle = away != null ? `${status} · ${awayText(away)}` : status;

  // Google Maps (or whatever handles map links) with directions to where they are now.
  const openDirections = () =>
    position && openLink(`https://www.google.com/maps/dir/?api=1&destination=${position.lat},${position.lng}`);
  const battery = position?.batteryPct;

  const travelled = history.data ? formatDistance(travelledM(timeline)) : null;
  const places = timeline.filter((item) => item.kind === 'stay').length;
  const openPath = () =>
    router.push({ pathname: '/group/[id]/history/[userId]', params: { id: groupId, userId: member.userId } });

  return (
    <View style={styles.container}>
      {/* The lowered sheet shows this part and ends in the gap below it, never through a row. */}
      <View style={styles.container} onLayout={(e) => onPeekHeight?.(e.nativeEvent.layout.height)}>
        <View style={styles.header}>
          <Avatar
            name={member.displayName}
            uri={member.avatarUrl}
            size={40}
            dim={!member.sharingEnabled || !!member.deletedAt}
          />
          <View style={styles.headerText}>
            <Text style={[typeStyles.heading, { color: colors.text }]} numberOfLines={1}>
              {isYou ? 'You' : member.displayName.split(' ')[0]}
            </Text>
            {/* Two lines: "Here since 10:12 AM · 10 m away" doesn't always fit on one. */}
            <Text style={[typeStyles.caption, { color: colors.muted }]} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
          <IconButton icon="close" filled accessibilityLabel="Close" onPress={onClose} />
        </View>

        {position && (
          <View style={styles.tiles}>
            <StatTile label="Updated" value={timeAgoShort(position.recordedAt, now)} />
            <StatTile
              label="Battery"
              value={
                battery != null ? (
                  <View style={styles.battery}>
                    <Icon
                      name={batteryIcon(battery)}
                      size={18}
                      filled
                      color={battery <= 20 ? colors.danger : colors.success}
                      style={styles.batteryIcon}
                    />
                    <Text style={[typeStyles.bodyStrong, { color: battery <= 20 ? colors.danger : colors.success }]}>
                      {battery}%
                    </Text>
                  </View>
                ) : (
                  '—'
                )
              }
            />
            <StatTile
              label="Accuracy"
              value={position.accuracyM != null ? `±${Math.round(position.accuracyM)} m` : '—'}
            />
          </View>
        )}

        <View style={styles.buttons}>
          {position && (
            <View style={styles.row}>
              {!isYou && (
                <Button
                  title="Directions"
                  icon="directions"
                  size="small"
                  onPress={openDirections}
                  style={styles.flex}
                />
              )}
              <Button
                size="small"
                title={following ? 'Following' : 'Follow'}
                variant={following ? 'strong' : 'secondary'}
                icon={following ? 'navigation' : 'near_me'}
                style={styles.flex}
                onPress={onToggleFollow}
              />
            </View>
          )}

          {canAsk && (
            <>
              <Button
                title={
                  asking
                    ? `Asking ${member.displayName.split(' ')[0]}'s phone…`
                    : answered
                      ? 'Got a fresh location'
                      : waiting
                        ? `Ask again in ${countdown(ask.waitMs)}`
                        : 'Get location now'
                }
                variant={answered ? 'strong' : 'outlined'}
                size="small"
                disabled={asking || waiting}
                readOnly={answered}
                onPress={ask.ask}
                icon={
                  asking ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : answered ? (
                    <Icon name="check_circle" size={18} filled color={colors.onAccentFill} />
                  ) : waiting ? (
                    'timer'
                  ) : (
                    'my_location'
                  )
                }
              />
              {waiting && (
                // How long until they can be asked again.
                <View style={[styles.waitTrack, { backgroundColor: colors.fill }]}>
                  <View
                    style={[
                      styles.waitBar,
                      { backgroundColor: colors.accent, width: `${(ask.waitMs / ASK_AGAIN_MS) * 100}%` },
                    ]}
                  />
                </View>
              )}
              {ask.message && (
                <View style={[styles.note, { backgroundColor: colors.dangerFill }]}>
                  <Icon name="error" size={20} color={colors.onDangerFill} />
                  <Text style={[typeStyles.caption, styles.flex, { color: colors.onDangerFill }]}>{ask.message}</Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>

      {/* A list row like the people list and settings: round icon, two lines, chevron. */}
      <Card>
        <Pressable
          onPress={openPath}
          accessibilityRole="button"
          android_ripple={{ color: `${colors.text}14` }}
          style={styles.path}>
          <View style={[styles.pathIcon, { backgroundColor: colors.tonal }]}>
            <Icon name="route" size={22} color={colors.onTonal} />
          </View>
          <View style={styles.flex}>
            <Text style={[typeStyles.bodyStrong, { color: colors.text }]}>Today&apos;s path</Text>
            <Text style={[typeStyles.caption, { color: colors.muted }]}>
              {travelled == null ? 'Loading…' : `${travelled} · ${places} ${places === 1 ? 'place' : 'places'}`}
            </Text>
          </View>
          <Icon name="chevron_right" color={colors.muted} />
        </Pressable>
      </Card>
    </View>
  );
}

const asFix = (p: LivePosition) => ({ lat: p.lat, lng: p.lng, time: 0 });

/** "350 m away", "2.3 km away", "48 km away". */
function awayText(meters: number) {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m away`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerText: { flex: 1 },
  tiles: { flexDirection: 'row', gap: 8 },
  battery: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  batteryIcon: { transform: [{ rotate: '90deg' }] },
  buttons: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  waitTrack: { height: 4, borderRadius: 2, marginHorizontal: 24, overflow: 'hidden' },
  waitBar: { height: 4, borderRadius: 2 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, padding: 12 },
  path: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pathIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
