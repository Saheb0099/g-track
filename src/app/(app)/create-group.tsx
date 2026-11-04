import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { MAX_MEMBERS, useCreateGroup } from '@/features/groups/api';
import { friendlyError } from '@/lib/errors';
import { type, useColors } from '@/lib/theme';

export default function CreateGroup() {
  const colors = useColors();
  const [name, setName] = useState('');
  const create = useCreateGroup();
  const trimmed = name.trim();

  function submit() {
    if (!trimmed) return;
    create.mutate(trimmed, {
      onSuccess: ({ groupId }) => router.replace({ pathname: '/group/[id]', params: { id: groupId } }),
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TextField
        label="Group name"
        hint={`You'll be the admin. Up to ${MAX_MEMBERS} people can join.`}
        placeholder="College gang"
        value={name}
        onChangeText={setName}
        maxLength={40}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {create.isError && <Text style={[styles.error, { color: colors.danger }]}>{friendlyError(create.error)}</Text>}
      <Button title="Create group" onPress={submit} disabled={!trimmed} loading={create.isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  error: { ...type.caption, fontSize: 14 },
});
