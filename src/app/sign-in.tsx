import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signInWithGoogle } from '@/lib/auth';
import { useColors } from '@/lib/theme';

export default function SignIn() {
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPress() {
    setBusy(true);
    setError(null);
    try {
      // On success the session changes and the route guard moves us to the home screen.
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.hero}>
        <Text style={[styles.title, { color: colors.text }]}>G Track</Text>
        <Text style={[styles.tagline, { color: colors.muted }]}>
          See where your friends are, and where everyone has been this week.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onPress}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.accent, opacity: pressed || busy ? 0.7 : 1 },
          ]}>
          {busy ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.onAccent }]}>Continue with Google</Text>
          )}
        </Pressable>
        {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center', gap: 12 },
  title: { fontSize: 40, fontWeight: '800' },
  tagline: { fontSize: 17, lineHeight: 24 },
  actions: { paddingBottom: 32, gap: 12 },
  button: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 17, fontWeight: '600' },
  error: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
