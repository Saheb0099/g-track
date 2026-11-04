import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { hasLookAlikes, isValidCode, normalizeCode } from '@/features/groups/api';
import { fonts, type, useColors } from '@/lib/theme';

export default function EnterCode() {
  const colors = useColors();
  const [code, setCode] = useState('');

  function submit() {
    if (!isValidCode(code)) return;
    router.replace({ pathname: '/join/[code]', params: { code } });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TextField
        label="Join code"
        hint="Ask the group's admin for the 6-character code. You can also paste their whole invite message."
        placeholder="K7P2QX"
        value={code}
        // No maxLength: it would cut a pasted message or link before normalizeCode finds the code in it.
        onChangeText={(text) => setCode(normalizeCode(text))}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        returnKeyType="go"
        onSubmitEditing={submit}
        style={styles.code}
      />
      {hasLookAlikes(code) && (
        <Text style={[styles.warning, { color: colors.danger }]}>
          {"Codes never contain 0, O, 1, I or L. Check the letters with your friend."}
        </Text>
      )}
      <Button title="Continue" onPress={submit} disabled={!isValidCode(code)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  code: { fontSize: 26, letterSpacing: 8, fontFamily: fonts.extrabold, height: 60 },
  warning: { ...type.caption, fontSize: 14, lineHeight: 20 },
});
