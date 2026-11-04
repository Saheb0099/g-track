import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { useMyProfile } from '@/features/profile/api';
import { signOut, useAuth } from '@/lib/auth';
import { useColors } from '@/lib/theme';

export default function Settings() {
  const colors = useColors();
  const { session } = useAuth();
  const profile = useMyProfile();
  const name = profile.data?.display_name ?? '';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.profile}>
        <Avatar name={name} uri={profile.data?.avatar_url} size={72} />
        <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
        <Text style={[styles.email, { color: colors.muted }]}>{session?.user.email}</Text>
      </View>
      <Button title="Sign out" variant="secondary" onPress={signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 24 },
  profile: { alignItems: 'center', gap: 6, paddingVertical: 16 },
  name: { fontSize: 22, fontWeight: '700', marginTop: 8 },
  email: { fontSize: 15 },
});
