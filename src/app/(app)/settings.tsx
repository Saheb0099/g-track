import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card, RowDivider, SectionLabel } from '@/components/card';
import { TextField } from '@/components/text-field';
import { useSharingStatus } from '@/features/location/sharing-status';
import { useChosenMapStyle } from '@/features/map/styles';
import { type SharingChoice, useMyProfile, useSetDisplayName, useSetSharing } from '@/features/profile/api';
import { APP_VERSION, useUpdateAvailable } from '@/lib/app-version';
import { setTheme, THEMES, useTheme, type Theme } from '@/lib/appearance';
import { deleteAccount, signOut, useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { fonts, radius, type as typeStyles, useColors } from '@/lib/theme';
import { untilText } from '@/lib/time';

const THEME_LABELS: Record<Theme, string> = { system: 'Automatic', light: 'Light', dark: 'Dark' };

export default function Settings() {
  // Edge-to-edge: keep the last item clear of Android's navigation bar.
  const safe = useSafeAreaInsets();
  const colors = useColors();
  const { session } = useAuth();
  const profile = useMyProfile();
  const status = useSharingStatus();
  const theme = useTheme();
  const update = useUpdateAvailable();
  const mapStyle = useChosenMapStyle();
  const setSharing = useSetSharing();
  const setName = useSetDisplayName();
  const [deleting, setDeleting] = useState(false);
  const name = profile.data?.display_name ?? '';
  const sharing = profile.data?.sharing_enabled ?? true;

  const pausedUntil = profile.data?.paused_until ?? null;

  function saveSharing(choice: SharingChoice) {
    setSharing.mutate(choice, {
      onError: (e) => Alert.alert("Couldn't change sharing", friendlyError(e)),
    });
  }

  function toggleSharing(on: boolean) {
    if (on) return saveSharing({ enabled: true });
    const inHours = (h: number) => new Date(Date.now() + h * 60 * 60_000);
    // Android shows at most 3 buttons, stacked last-first (so 1 hour is on top); tapping outside cancels.
    Alert.alert(
      'Pause sharing',
      'Your groups will see your past week, but not where you are now.',
      [
        { text: 'Until I turn it on', onPress: () => saveSharing({ enabled: false, until: null }) },
        { text: '8 hours', onPress: () => saveSharing({ enabled: false, until: inHours(8) }) },
        { text: '1 hour', onPress: () => saveSharing({ enabled: false, until: inHours(1) }) },
      ],
      { cancelable: true },
    );
  }

  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      "Your account and all your location history will be removed in 7 days. Until then your groups can still see your past week, but not where you are now, and groups you're admin of pass to the next member. Sign in again before then if you change your mind.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              // Signs out on success, which takes you to the sign-in screen.
              await deleteAccount();
            } catch (e) {
              setDeleting(false);
              Alert.alert("Couldn't delete your account", friendlyError(e));
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingBottom: safe.bottom + 32 }]}>
      <View style={styles.profile}>
        <Avatar name={name || '?'} uri={profile.data?.avatar_url} size={80} />
        <Text style={[typeStyles.title, { color: colors.text }]}>{name}</Text>
        <Text style={[typeStyles.caption, { color: colors.muted, fontSize: 14 }]}>{session?.user.email}</Text>
      </View>

      {profile.data && (
        <View style={styles.section}>
          {/* Keyed by the saved name so the field resets after saving. */}
          <NameForm
            key={name}
            current={name}
            saving={setName.isPending}
            onSave={(next) =>
              setName.mutate(next, { onError: (e) => Alert.alert("Couldn't change your name", friendlyError(e)) })
            }
          />
        </View>
      )}

      <View style={styles.section}>
        <SectionLabel>Location</SectionLabel>
        <Card>
          <View style={styles.row}>
            <View style={[styles.icon, { backgroundColor: sharing ? colors.accentFill : colors.fill }]}>
              <Ionicons name={sharing ? 'radio' : 'pause'} size={18} color={sharing ? colors.accent : colors.muted} />
            </View>
            <View style={styles.flex}>
              <Text style={[typeStyles.bodyStrong, { color: colors.text }]}>Share my location</Text>
              <Text style={[typeStyles.caption, { color: colors.muted }]}>
                {sharing
                  ? 'Your groups see where you are now'
                  : `${pausedUntil ? `Paused until ${untilText(pausedUntil)}` : 'Paused'}. Your groups see your past week, not where you are now`}
              </Text>
            </View>
            <Switch
              value={sharing}
              onValueChange={toggleSharing}
              disabled={!profile.data}
              accessibilityLabel="Share my location"
              trackColor={{ true: colors.accent, false: colors.fill }}
              thumbColor="#FFFFFF"
            />
          </View>
          <RowDivider inset={62} />
          <Pressable
            onPress={() => router.push('/setup')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
            <View style={[styles.icon, { backgroundColor: colors.accentFill }]}>
              <Ionicons name="navigate" size={18} color={colors.accent} />
            </View>
            <View style={styles.flex}>
              <Text style={[typeStyles.bodyStrong, { color: colors.text }]}>Permissions and battery</Text>
              <Text style={[typeStyles.caption, { color: colors.muted }]}>{status?.label ?? 'Checking…'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionLabel>Appearance</SectionLabel>
        <Card>
          <View style={styles.row}>
            <View style={[styles.icon, { backgroundColor: colors.accentFill }]}>
              <Ionicons name="contrast" size={18} color={colors.accent} />
            </View>
            <Text style={[typeStyles.bodyStrong, styles.flex, { color: colors.text }]}>Theme</Text>
          </View>
          {/* Automatic follows the phone's own light or dark setting. */}
          <View style={[styles.segments, { backgroundColor: colors.fill }]} accessibilityRole="radiogroup">
            {THEMES.map((choice) => {
              const active = choice === theme;
              return (
                <Pressable
                  key={choice}
                  onPress={() => setTheme(choice)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={[styles.segment, active && { backgroundColor: colors.surface }]}>
                  <Text
                    style={[
                      typeStyles.caption,
                      { color: active ? colors.text : colors.muted, fontFamily: active ? fonts.bold : fonts.medium },
                    ]}>
                    {THEME_LABELS[choice]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <RowDivider inset={62} />
          <Pressable
            onPress={() => router.push('/map-style')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
            <View style={[styles.icon, { backgroundColor: colors.accentFill }]}>
              <Ionicons name="layers" size={18} color={colors.accent} />
            </View>
            <View style={styles.flex}>
              <Text style={[typeStyles.bodyStrong, { color: colors.text }]}>Map style</Text>
              <Text style={[typeStyles.caption, { color: colors.muted }]}>{mapStyle.name}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        </Card>
      </View>

      <View style={styles.account}>
        <Button title="Sign out" variant="secondary" onPress={signOut} disabled={deleting} />
        <Pressable
          onPress={confirmDelete}
          disabled={deleting}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.delete, { opacity: pressed ? 0.6 : 1 }]}>
          {deleting ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={[typeStyles.bodyStrong, { color: colors.danger }]}>Delete account</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.version}>
        <Text style={[typeStyles.caption, { color: colors.muted }]}>G Track {APP_VERSION}</Text>
        {update && (
          <Text style={[typeStyles.caption, { color: colors.accentText, textAlign: 'center' }]}>
            Version {update} is out. Ask the friend who shared G Track for the new file.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function NameForm({ current, saving, onSave }: { current: string; saving: boolean; onSave: (name: string) => void }) {
  const [name, setName] = useState(current);
  const trimmed = name.trim();
  return (
    <View style={styles.nameRow}>
      <View style={styles.flex}>
        <TextField
          label="Your name"
          hint="The name people in your groups see."
          value={name}
          onChangeText={setName}
          maxLength={50}
          autoCapitalize="words"
        />
      </View>
      <Button
        title="Save"
        variant="secondary"
        disabled={!trimmed || trimmed === current}
        loading={saving}
        onPress={() => onSave(trimmed)}
        style={styles.saveButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  saveButton: { height: 54, borderRadius: 16, marginTop: 29 },
  container: { padding: 16, gap: 24, paddingBottom: 48 },
  profile: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  section: { gap: 8 },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  segments: { flexDirection: 'row', marginHorizontal: 14, marginBottom: 14, padding: 3, borderRadius: radius.pill },
  account: { gap: 8 },
  version: { alignItems: 'center', gap: 4 },
  delete: { height: 48, alignItems: 'center', justifyContent: 'center' },
  segment: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
});
