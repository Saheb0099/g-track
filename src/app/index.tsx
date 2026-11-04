import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { signOut, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

type Profile = { display_name: string; sharing_enabled: boolean };

export default function Home() {
  const colors = useColors();
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  // Temporary home until groups arrive in phase 3: shows the profile the database made on sign-in.
  useEffect(() => {
    if (!session) return;
    supabase
      .from('profiles')
      .select('display_name, sharing_enabled')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data));
  }, [session]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        {profile ? `Hi, ${profile.display_name}` : 'Signed in'}
      </Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>{session?.user.email}</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>Groups and the map will live here.</Text>

      <Pressable
        onPress={signOut}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}>
        <Text style={[styles.buttonText, { color: colors.text }]}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 16 },
  button: { marginTop: 24, paddingHorizontal: 24, height: 44, borderRadius: 10, borderWidth: 1, justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
