import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { isValidCode, MAX_MEMBERS, normalizeCode, useJoinGroup, usePreviewGroup } from '@/features/groups/api';
import { errorMessage, friendlyError } from '@/lib/errors';
import { type, useColors } from '@/lib/theme';

// Reached by typing a code, or by opening an invite link: gtrack://join/CODE
export default function JoinGroup() {
  const colors = useColors();
  const params = useLocalSearchParams<{ code: string }>();
  const code = normalizeCode(params.code ?? '');
  const preview = usePreviewGroup(code);
  const join = useJoinGroup();

  const openGroup = (id: string) => router.replace({ pathname: '/group/[id]', params: { id } });

  function message(title: string, body: string, action?: ReactNode) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>{body}</Text>
        {action}
      </View>
    );
  }

  if (!isValidCode(code)) {
    return message("That's not a G Track code", 'Join codes have 6 letters and numbers, like K7P2QX.');
  }
  if (preview.isPending) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }
  if (preview.isError) {
    if (errorMessage(preview.error).includes('too_many_tries')) {
      return message('Too many wrong codes', 'To keep groups safe, codes are paused for an hour. Try again later.');
    }
    return message(
      "Couldn't check this code",
      friendlyError(preview.error),
      <Button title="Try again" onPress={() => preview.refetch()} />,
    );
  }

  const group = preview.data;
  if (!group) {
    return message(
      'No group uses this code',
      'Check the code with your friend. The admin may have replaced it with a new one.',
    );
  }
  if (group.isMember) {
    return message(
      `You're already in ${group.name}`,
      '',
      <Button title="Open group" onPress={() => openGroup(group.groupId)} />,
    );
  }
  if (group.isClosing) {
    return message(`${group.name} is being deleted`, "Its admin is deleting it, so it isn't taking new members.");
  }
  if (group.memberCount >= MAX_MEMBERS) {
    return message(`${group.name} is full`, `A group can have at most ${MAX_MEMBERS} people.`);
  }

  return message(
    group.name,
    `${group.memberCount} of ${MAX_MEMBERS} members. Once you join, people in this group can see your location and where you've been this week.`,
    <>
      {join.isError && <Text style={[styles.body, { color: colors.danger }]}>{friendlyError(join.error)}</Text>}
      <Button title="Join group" loading={join.isPending} onPress={() => join.mutate(code, { onSuccess: openGroup })} />
    </>,
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  center: { alignItems: 'center' },
  title: { ...type.title },
  body: { ...type.body, fontSize: 16, lineHeight: 23, marginBottom: 12 },
});
