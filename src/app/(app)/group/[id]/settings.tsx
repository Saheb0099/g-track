import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card, RowDivider, SectionLabel } from '@/components/card';
import { TextField } from '@/components/text-field';
import {
  MAX_MEMBERS,
  useGroup,
  useInviteCode,
  useKickMember,
  useLeaveGroup,
  useMembers,
  useRegenerateCode,
  useRenameGroup,
  useTransferAdmin,
  type Member,
} from '@/features/groups/api';
import { shareInvite } from '@/features/groups/invite';
import { MemberRow } from '@/features/groups/member-row';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { fonts, radius, type as typeStyles, useColors } from '@/lib/theme';

const showError = (error: unknown) => Alert.alert('Something went wrong', friendlyError(error));

export default function GroupSettings() {
  const colors = useColors();
  const safe = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const me = session?.user.id;

  const group = useGroup(id);
  const members = useMembers(id);
  const isAdmin = !!group.data && group.data.adminId === me;
  const invite = useInviteCode(id, isAdmin);

  const regenerate = useRegenerateCode(id);
  const rename = useRenameGroup(id);
  const kick = useKickMember(id);
  const transfer = useTransferAdmin(id);
  const leave = useLeaveGroup(id);
  const [now] = useState(() => Date.now());

  const close = () => router.back();

  if (group.isPending || members.isPending) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!group.data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[typeStyles.heading, { color: colors.text, textAlign: 'center' }]}>
          {"You're not in this group any more"}
        </Text>
        <Button title="Back to the map" variant="secondary" onPress={() => router.dismissTo('/')} />
      </View>
    );
  }

  const groupName = group.data.name;
  const adminId = group.data.adminId;
  const memberList = members.data ?? [];
  const admin = memberList.find((m) => m.userId === adminId);
  const others = memberList.filter((m) => m.userId !== me);

  function confirmNewCode() {
    Alert.alert('Make a new code?', 'The current code and invite link will stop working.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'New code', onPress: () => regenerate.mutate(undefined, { onError: showError }) },
    ]);
  }

  function memberActions(member: Member) {
    Alert.alert(member.displayName, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Make admin',
        onPress: () =>
          Alert.alert(
            `Make ${member.displayName} admin?`,
            "You'll stop being admin. Only the admin can invite and remove people.",
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Make admin', onPress: () => transfer.mutate(member.userId, { onError: showError }) },
            ],
          ),
      },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          Alert.alert(`Remove ${member.displayName}?`, 'They will no longer see this group or anyone in it.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => kick.mutate(member.userId, { onError: showError }) },
          ]),
      },
    ]);
  }

  function confirmLeave() {
    const next = others[0];
    const detail = !isAdmin
      ? 'People in this group will no longer see you, and you will no longer see them.'
      : next
        ? `${next.displayName} will become the admin.`
        : "You're the only member, so the group will be deleted.";
    Alert.alert(`Leave ${groupName}?`, detail, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => leave.mutate(undefined, { onSuccess: () => router.dismissTo('/'), onError: showError }),
      },
    ]);
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: safe.top + 12, paddingBottom: safe.bottom + 32 }]}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={[typeStyles.heading, { color: colors.onAccent, fontSize: 18 }]}>{groupName[0].toUpperCase()}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[typeStyles.title, { color: colors.text, fontSize: 24 }]} numberOfLines={1}>
            {groupName}
          </Text>
          <Text style={[typeStyles.caption, { color: colors.muted }]}>
            {memberList.length} of {MAX_MEMBERS} members{isAdmin ? " · You're admin" : ''}
          </Text>
        </View>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={[styles.close, { backgroundColor: colors.fill }]}>
          <Ionicons name="close" size={18} color={colors.muted} />
        </Pressable>
      </View>

      {isAdmin ? (
        <Card style={styles.invite}>
          <SectionLabel>Invite friends</SectionLabel>
          {invite.data ? (
            <View style={styles.codeRow} accessible accessibilityLabel={`Join code ${invite.data.split('').join(' ')}`}>
              {invite.data.split('').map((ch, i) => (
                <View key={i} style={[styles.codeBox, { backgroundColor: colors.background }]}>
                  <Text style={[styles.codeChar, { color: colors.text }]}>{ch}</Text>
                </View>
              ))}
            </View>
          ) : (
            <ActivityIndicator style={styles.codeLoading} />
          )}
          <View style={styles.row}>
            <Button
              title="Share invite link"
              style={styles.grow2}
              disabled={!invite.data}
              onPress={() => invite.data && shareInvite(groupName, invite.data)}
              icon={<Ionicons name="share-outline" size={18} color={colors.onAccent} />}
            />
            <Button
              title="New code"
              variant="secondary"
              style={styles.flex}
              loading={regenerate.isPending}
              onPress={confirmNewCode}
            />
          </View>
        </Card>
      ) : (
        <Card style={styles.invite}>
          <SectionLabel>Invite friends</SectionLabel>
          <Text style={[typeStyles.body, { color: colors.muted }]}>
            Only {admin?.displayName ?? 'the admin'} (the admin) can invite people. Ask them for the join code.
          </Text>
        </Card>
      )}

      <View style={styles.section}>
        <SectionLabel>Members</SectionLabel>
        <Card>
          {memberList.map((member, i) => (
            <Fragment key={member.userId}>
              {i > 0 && <RowDivider />}
              <MemberRow
                member={member}
                now={now}
                isYou={member.userId === me}
                // The Admin badge on the right says it; no need to repeat it in the status line.
                isAdmin={false}
                trailing={
                  member.userId === adminId ? (
                    <View style={[styles.adminChip, { backgroundColor: colors.accentFill }]}>
                      <Text style={[typeStyles.caption, { color: colors.accentText, fontFamily: fonts.bold, fontSize: 12 }]}>
                        Admin
                      </Text>
                    </View>
                  ) : isAdmin ? (
                    <Pressable
                      onPress={() => memberActions(member)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Options for ${member.displayName}`}
                      style={styles.more}>
                      <Ionicons name="ellipsis-horizontal" size={22} color={colors.muted} />
                    </Pressable>
                  ) : (
                    <View />
                  )
                }
              />
            </Fragment>
          ))}
        </Card>
      </View>

      {isAdmin && (
        <View style={styles.section}>
          <SectionLabel>Name</SectionLabel>
          {/* Keyed by the saved name so the field resets after a rename. */}
          <RenameForm
            key={groupName}
            current={groupName}
            saving={rename.isPending}
            onSave={(next) => rename.mutate(next, { onError: showError })}
          />
        </View>
      )}

      <Button title="Leave group" variant="danger" loading={leave.isPending} onPress={confirmLeave} />
    </ScrollView>
  );
}

function RenameForm({ current, saving, onSave }: { current: string; saving: boolean; onSave: (name: string) => void }) {
  const [name, setName] = useState(current);
  const trimmed = name.trim();
  return (
    <View style={styles.renameRow}>
      <View style={styles.flex}>
        <TextField label="Group name" value={name} onChangeText={setName} maxLength={40} />
      </View>
      <Button
        title="Save"
        variant="secondary"
        disabled={!trimmed || trimmed === current}
        loading={saving}
        onPress={() => onSave(trimmed)}
        style={styles.saveButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, gap: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  grow2: { flex: 2 },
  invite: { padding: 18, gap: 14 },
  codeRow: { flexDirection: 'row', gap: 6 },
  codeBox: { flex: 1, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  codeChar: { fontFamily: fonts.extrabold, fontSize: 26 },
  codeLoading: { height: 56 },
  row: { flexDirection: 'row', gap: 10 },
  section: { gap: 8 },
  adminChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  more: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  renameRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  saveButton: { height: 54, borderRadius: 16 },
});
