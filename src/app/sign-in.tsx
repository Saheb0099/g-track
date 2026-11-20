import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { avatarColors } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { useRememberInvite } from '@/features/groups/pending-invite';
import { useAppColorScheme } from '@/lib/appearance';
import { signInWithGoogle } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { openLink, PRIVACY_URL } from '@/lib/links';
import { type as typeStyles, useColors } from '@/lib/theme';

/** Where the friends sit on the illustration: offset in the 300 pt shape, size, and a name for the colour. */
const FRIENDS = [
  { left: 72, top: 64, size: 56, seed: 'b' },
  { left: 196, top: 56, size: 48, seed: 'c' },
  { left: 58, top: 186, size: 44, seed: 'd' },
];
/** The shape behind them: a circle with eight scallops. */
const SCALLOPS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * 2 * Math.PI - Math.PI / 2;
  return { left: 110 + Math.cos(angle) * 110, top: 110 + Math.sin(angle) * 110 };
});

export default function SignIn() {
  const colors = useColors();
  const dark = useAppColorScheme() === 'dark';
  const safe = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useRememberInvite();

  async function onPress() {
    setBusy(true);
    setError(null);
    try {
      // On success the session changes and the route guard moves us to the map.
      await signInWithGoogle();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: safe.top + 32, paddingBottom: safe.bottom + 24 }]}>

      {/* Friends gathered on a soft shape: decoration only. */}
      <View style={styles.art} accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={[styles.blob, { backgroundColor: colors.accentFill }]} />
        {SCALLOPS.map((p, i) => (
          <View key={i} style={[styles.scallop, { left: p.left, top: p.top, backgroundColor: colors.accentFill }]} />
        ))}
        {FRIENDS.map((f) => {
          const [bg, fg] = avatarColors(f.seed, dark);
          return (
            <View
              key={f.seed}
              style={[
                styles.friend,
                {
                  left: f.left,
                  top: f.top,
                  width: f.size,
                  height: f.size,
                  backgroundColor: bg,
                  borderColor: colors.surface,
                },
              ]}>
              <Icon name="location_on" size={f.size * 0.45} filled color={fg} />
            </View>
          );
        })}
        <View
          style={[
            styles.friend,
            { left: 176, top: 160, width: 64, height: 64, backgroundColor: colors.accent, borderColor: colors.surface },
          ]}>
          <Icon name="my_location" size={28} color={colors.onAccent} />
        </View>
      </View>

      <View style={styles.copy}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: colors.accent }]}>
            <Icon name="location_on" size={22} filled color={colors.onAccent} />
          </View>
          <Text style={[typeStyles.heading, { color: colors.text, fontSize: 20 }]}>G Track</Text>
        </View>
        <Text style={[styles.headline, { color: colors.text }]}>Your friends, on one map.</Text>
        <Text style={[typeStyles.body, { color: colors.muted }]}>
          See where everyone is and where they&apos;ve been this week. Only people in your groups can see you.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onPress}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ busy }}
          android_ripple={{ color: `${colors.onAccent}33`, foreground: true }}
          style={[styles.google, { backgroundColor: colors.accent }]}>
          {busy ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <>
              <View style={styles.g}>
                <Ionicons name="logo-google" size={16} color="#355CA8" />
              </View>
              <Text style={[typeStyles.button, { color: colors.onAccent, fontSize: 16 }]}>Continue with Google</Text>
            </>
          )}
        </Pressable>
        {error && <Text style={[typeStyles.caption, styles.center, { color: colors.danger }]}>{error}</Text>}
        <Text
          style={[typeStyles.caption, styles.center, styles.link, { color: colors.accentText, fontSize: 12 }]}
          onPress={() => openLink(PRIVACY_URL)}
          accessibilityRole="link">
          Privacy policy
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24, gap: 32 },
  art: { width: 300, height: 300, alignSelf: 'center' },
  blob: { position: 'absolute', left: 38, top: 38, width: 224, height: 224, borderRadius: 112 },
  scallop: { position: 'absolute', width: 80, height: 80, borderRadius: 40 },
  friend: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  copy: { flex: 1, gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headline: { ...typeStyles.title, fontSize: 36, lineHeight: 44 },
  actions: { gap: 16 },
  google: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  g: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  link: { textDecorationLine: 'underline' },
});
