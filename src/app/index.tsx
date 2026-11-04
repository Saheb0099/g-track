import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { supabase } from '@/lib/supabase';

type Check = 'checking' | 'connected' | 'failed';

export default function Home() {
  const color = useColorScheme() === 'dark' ? '#fff' : '#111';
  const [check, setCheck] = useState<Check>('checking');

  // Temporary until sign-in lands in phase 2: proves the app can reach the backend.
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(() =>
        fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
          headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
        }),
      )
      .then((res) => setCheck(res.ok ? 'connected' : 'failed'))
      .catch(() => setCheck('failed'));
  }, []);

  const label = {
    checking: 'Checking Supabase…',
    connected: 'Connected to Supabase',
    failed: 'Could not reach Supabase',
  }[check];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'G Track' }} />
      <Text style={[styles.title, { color }]}>G Track</Text>
      <Text style={[styles.subtitle, { color }]}>Groups and the map will live here.</Text>
      <Text style={[styles.status, { color: check === 'failed' ? '#d33' : color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 16, opacity: 0.6 },
  status: { fontSize: 14, marginTop: 16 },
});
