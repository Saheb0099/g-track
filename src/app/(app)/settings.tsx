import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card, SectionLabel } from '@/components/card';
import { useSharingStatus } from '@/features/location/sharing-status';
import { useMyProfile } from '@/features/profile/api';
import { signOut, useAuth } from '@/lib/auth';
import { type as typeStyles, useColors } from '@/lib/theme';

export default function Settings() {
  const colors = useColors();
  const { session } = useAuth();
  const profile = useMyProfile();
  const status = useSharingStatus();
  const name = profile.data?.display_name ?? '';

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={styles.profile}>
        <Avatar name={name || '?'} uri={profile.data?.avatar_url} size={80} />
        <Text style={[typeStyles.title, { color: colors.text }]}>{name}</Text>
        <Text style={[typeStyles.caption, { color: colors.muted, fontSize: 14 }]}>{session?.user.email}</Text>
      </View>

      <View style={styles.section}>
        <SectionLabel>Location</SectionLabel>
        <Card>
          <Pressable
            onPress={() => router.push('/setup')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
            <View style={[styles.icon, { backgroundColor: colors.accentFill }]}>
              <Ionicons name="navigate" size={18} color={colors.accent} />
            </View>
            <View style={styles.flex}>
              <Text style={[typeStyles.bodyStrong, { color: colors.text }]}>Location sharing</Text>
              <Text style={[typeStyles.caption, { color: colors.muted }]}>{status?.label ?? 'Checking…'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        </Card>
      </View>

      <Button title="Sign out" variant="secondary" onPress={signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 24, paddingBottom: 48 },
  profile: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  section: { gap: 8 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
});
