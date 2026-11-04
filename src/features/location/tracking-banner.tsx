import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useSetupChecks, useTracking } from '@/features/location/use-tracking';
import { useMyProfile } from '@/features/profile/api';
import { useColors } from '@/lib/theme';

/** One line on My groups saying whether location sharing works; tapping opens the setup checklist. */
export function TrackingBanner() {
  const colors = useColors();
  const profile = useMyProfile();
  const tracking = useTracking();
  const checks = useSetupChecks();

  if (!profile.data || !tracking.data) return null;

  const r = tracking.data;
  let text: string;
  let ok = false;
  if (!profile.data.sharing_enabled) {
    text = 'Location sharing is paused';
  } else if (!r.foreground || !r.background) {
    text = 'Set up location sharing';
  } else if (!r.servicesOn) {
    text = 'Location is off on this phone';
  } else if (checks.data?.batteryOptimized) {
    text = 'Sharing your location · finish battery setup';
  } else {
    text = 'Sharing your location';
    ok = true;
  }

  return (
    <Pressable
      onPress={() => router.push('/setup')}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.banner,
        { borderColor: ok ? colors.border : colors.accent, opacity: pressed ? 0.6 : 1 },
      ]}>
      <Ionicons name={ok ? 'radio' : 'alert-circle-outline'} size={20} color={colors.accent} />
      <Text style={[styles.text, { color: colors.text }]}>{text}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  text: { flex: 1, fontSize: 15, fontWeight: '600' },
});
