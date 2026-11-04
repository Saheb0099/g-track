import { Ionicons } from '@expo/vector-icons';
import { Camera, Map } from '@maplibre/maplibre-react-native';
import { BlurTargetView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState, type ComponentRef } from 'react';
import { Linking, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Glass, GlassTarget } from '@/components/glass';
import { useRememberInvite } from '@/features/groups/pending-invite';
import { useMapStyle } from '@/features/map/styles';
import { signInWithGoogle } from '@/lib/auth';
import { fonts, radius, type as typeStyles, useColors } from '@/lib/theme';

const PRIVACY_URL = 'https://saheb0099.github.io/g-track-site/privacy.html';

export default function SignIn() {
  const colors = useColors();
  const dark = useColorScheme() === 'dark';
  const safe = useSafeAreaInsets();
  const mapStyle = useMapStyle();
  const blurTarget = useRef<ComponentRef<typeof View>>(null);
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
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {/* A still map as the backdrop; it isn't interactive. */}
      <BlurTargetView ref={blurTarget} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Map style={StyleSheet.absoluteFill} mapStyle={mapStyle} logo={false} attribution={false} androidView="texture">
          <Camera initialViewState={{ center: [78.9, 22.6], zoom: 4.2 }} />
        </Map>
      </BlurTargetView>

      <GlassTarget.Provider value={blurTarget}>
        <View style={[styles.cardWrap, { paddingBottom: safe.bottom + 16 }]}>
          <Glass radius={radius.sheet} floating style={styles.card}>
            <View style={styles.brand}>
              <View style={[styles.logo, { backgroundColor: colors.accent }]}>
                <Ionicons name="location" size={28} color={colors.onAccent} />
              </View>
              <Text style={[styles.wordmark, { color: colors.text }]}>G Track</Text>
            </View>
            <View style={styles.copy}>
              <Text style={[typeStyles.heading, { color: colors.text }]}>Your friends, on one map.</Text>
              <Text style={[typeStyles.body, { color: colors.muted }]}>
                See where everyone is and where they&apos;ve been this week. Only people in your groups can see you.
              </Text>
            </View>
            <Button
              title="Continue with Google"
              variant="strong"
              loading={busy}
              onPress={onPress}
              style={styles.google}
              icon={<Ionicons name="logo-google" size={18} color={colors.onStrong} />}
            />
            {error && <Text style={[typeStyles.caption, styles.center, { color: colors.danger }]}>{error}</Text>}
            <Text
              style={[typeStyles.caption, styles.center, styles.link, { color: colors.muted }]}
              onPress={() => Linking.openURL(PRIVACY_URL)}
              accessibilityRole="link">
              Privacy policy
            </Text>
          </Glass>
        </View>
      </GlassTarget.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cardWrap: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 16 },
  card: { padding: 22, paddingTop: 26, gap: 18 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontFamily: fonts.extrabold, fontSize: 30, letterSpacing: -0.6 },
  copy: { gap: 6 },
  google: { height: 56, borderRadius: 28 },
  center: { textAlign: 'center' },
  link: { textDecorationLine: 'underline' },
});
