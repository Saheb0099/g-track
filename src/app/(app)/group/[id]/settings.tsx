import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import {
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
import { useColors } from '@/lib/theme';

const showError = (error: unknown) => Alert.alert('Something went wrong', friendlyError(error));

export default function GroupSettings() {
  const colors = useColors();
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
        <Text style={[styles.heading, { color: colors.text }]}>{"You're not in this group any more"}</Text>
        <Button title="Back to my groups" variant="secondary" onPress={() => router.dismissTo('/')} />
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
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => kick.mutate(member.userId, { onError: showError }),
            },
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
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.section, { color: colors.muted }]}>INVITE</Text>
      {isAdmin ? (
        <View style={[styles.card, { borderColor: colors.border }]}>
          <Text style={{ color: colors.muted }}>Join code</Text>
          {invite.data ? (
            <Text style={[styles.code, { color: colors.text }]} selectable>
              {invite.data}
            </Text>
          ) : (
            <ActivityIndicator style={styles.codeLoading} />
          )}
          <Button
            title="Share invite"
            disabled={!invite.data}
            onPress={() => invite.data && shareInvite(groupName, invite.data)}
          />
          <Button title="Make a new code" variant="secondary" loading={regenerate.isPending} onPress={confirmNewCode} />
        </View>
      ) : (
        <Text style={[styles.note, { color: colors.muted }]}>
          Only {admin?.displayName ?? 'the admin'} (the admin) can invite people. Ask them for the join code.
        </Text>
      )}

      <Text style={[styles.section, { color: colors.muted }]}>MEMBERS · {memberList.length}</Text>
      <View>
        {memberList.map((member) => (
          <MemberRow
            key={member.userId}
            member={member}
            isAdmin={member.userId === adminId}
            isYou={member.userId === me}
            action={
              isAdmin && member.userId !== me ? (
                <Pressable
                  onPress={() => memberActions(member)}
                  hitSlop={12}
                  accessibilityLabel={`Options for ${member.displayName}`}>
                  <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
                </Pressable>
              ) : undefined
            }
          />
        ))}
      </View>

      {isAdmin && (
        <>
          <Text style={[styles.section, { color: colors.muted }]}>NAME</Text>
          {/* Keyed by the saved name so the field resets after a rename. */}
          <RenameForm
            key={groupName}
            current={groupName}
            saving={rename.isPending}
            onSave={(next) => rename.mutate(next, { onError: showError })}
          />
        </>
      )}

      <View style={styles.leave}>
        <Button title="Leave group" variant="danger" loading={leave.isPending} onPress={confirmLeave} />
      </View>
    </ScrollView>
  );
}

function RenameForm({ current, saving, onSave }: { current: string; saving: boolean; onSave: (name: string) => void }) {
  const [name, setName] = useState(current);
  const trimmed = name.trim();
  return (
    <>
      <TextField label="Group name" value={name} onChangeText={setName} maxLength={40} />
      <Button
        title="Save name"
        variant="secondary"
        disabled={!trimmed || trimmed === current}
        loading={saving}
        onPress={() => onSave(trimmed)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  heading: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  section: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, marginTop: 12 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  code: { fontSize: 34, fontWeight: '800', letterSpacing: 8, marginBottom: 4 },
  codeLoading: { height: 44, alignSelf: 'flex-start' },
  note: { fontSize: 15, lineHeight: 22 },
  leave: { marginTop: 24 },
});
