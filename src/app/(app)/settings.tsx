import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card, RowDivider, SectionLabel } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { Switch } from '@/components/switch';
import { TextField } from '@/components/text-field';
import { useSharingStatus } from '@/features/location/sharing-status';
import { useChosenMapStyle } from '@/features/map/styles';
import { type SharingChoice, useMyProfile, useSetDisplayName, useSetSharing } from '@/features/profile/api';
import { APP_VERSION, useUpdateAvailable } from '@/lib/app-version';
import { setTheme, THEMES, useTheme, type Theme } from '@/lib/appearance';
import { deleteAccount, signOut, useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { radius, type as typeStyles, useColors } from '@/lib/theme';
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
      // Ends at Android's navigation bar, so nothing scrolls behind its buttons.
      style={{ backgroundColor: colors.background, marginBottom: safe.bottom }}
      contentContainerStyle={[styles.container, { paddingBottom: 32 }]}>
      <Card style={styles.profile}>
        <Avatar name={name || '?'} uri={profile.data?.avatar_url} size={64} />
        <View style={styles.flex}>
          <Text style={[typeStyles.heading, { color: colors.text, fontSize: 20 }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[typeStyles.caption, { color: colors.muted }]} numberOfLines={1}>
            {session?.user.email}
          </Text>
        </View>
      </Card>

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
            <Lead icon={sharing ? 'share_location' : 'pause_circle'} on={sharing} />
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
            />
          </View>
          <RowDivider />
          <Pressable
            onPress={() => router.push('/setup')}
            accessibilityRole="button"
            android_ripple={{ color: `${colors.text}14` }}
            style={styles.row}>
            <Lead icon="verified_user" on={status?.tone === 'ok'} good />
            <View style={styles.flex}>
              <Text style={[typeStyles.bodyStrong, { color: colors.text }]}>Permissions and battery</Text>
              <Text style={[typeStyles.caption, { color: colors.muted }]}>{status?.label ?? 'Checking…'}</Text>
            </View>
            <Icon name="chevron_right" color={colors.muted} />
          </Pressable>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionLabel>Appearance</SectionLabel>
        <Card>
          <View style={styles.row}>
            <Lead icon="contrast" />
            <Text style={[typeStyles.bodyStrong, styles.flex, { color: colors.text }]}>Theme</Text>
          </View>
          {/* Material's segmented button. Automatic follows the phone's own light or dark setting. */}
          <View style={styles.segments} accessibilityRole="radiogroup">
            {THEMES.map((choice, i) => {
              const active = choice === theme;
              return (
                <Pressable
                  key={choice}
                  onPress={() => setTheme(choice)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={[
                    styles.segment,
                    { borderColor: colors.outline, backgroundColor: active ? colors.tonal : 'transparent' },
                    i === 0 && styles.segmentFirst,
                    i === THEMES.length - 1 && styles.segmentLast,
                    i > 0 && styles.segmentNext,
                  ]}>
                  {active && <Icon name="check" size={18} color={colors.onStrong} />}
                  <Text style={[typeStyles.label, { color: active ? colors.onStrong : colors.text }]}>
                    {THEME_LABELS[choice]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <RowDivider />
          <Pressable
            onPress={() => router.push('/map-style')}
            accessibilityRole="button"
            android_ripple={{ color: `${colors.text}14` }}
            style={styles.row}>
            <Lead icon="map" />
            <View style={styles.flex}>
              <Text style={[typeStyles.bodyStrong, { color: colors.text }]}>Map style</Text>
              <Text style={[typeStyles.caption, { color: colors.muted }]}>{mapStyle.name}</Text>
            </View>
            <Icon name="chevron_right" color={colors.muted} />
          </Pressable>
        </Card>
      </View>

      <Card>
        <Pressable
          onPress={() => router.push('/about')}
          accessibilityRole="button"
          android_ripple={{ color: `${colors.text}14` }}
          style={styles.row}>
          <Lead icon="info" />
          <View style={styles.flex}>
            <Text style={[typeStyles.bodyStrong, { color: colors.text }]}>About G Track</Text>
            <Text style={[typeStyles.caption, { color: colors.muted }]}>
              Version {APP_VERSION}, map credits, privacy policy
            </Text>
          </View>
          <Icon name="chevron_right" color={colors.muted} />
        </Pressable>
      </Card>

      <View style={styles.account}>
        <Button title="Sign out" variant="outlined" icon="logout" onPress={signOut} disabled={deleting} />
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

      {update && (
        <Text style={[typeStyles.caption, { color: colors.accentText, textAlign: 'center' }]}>
          Version {update} is out. Ask the friend who shared G Track for the new file.
        </Text>
      )}
    </ScrollView>
  );
}

/** The round icon at the start of a settings row; `good` turns it green when on. */
function Lead({ icon, on = true, good = false }: { icon: IconName; on?: boolean; good?: boolean }) {
  const colors = useColors();
  const bg = !on ? colors.fill : good ? colors.successFill : colors.tonal;
  const fg = !on ? colors.muted : good ? colors.onSuccessFill : colors.onTonal;
  return (
    <View style={[styles.icon, { backgroundColor: bg }]}>
      <Icon name={icon} size={22} filled={on} color={fg} />
    </View>
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
  saveButton: { marginTop: 12 },
  container: { padding: 16, gap: 20, paddingBottom: 48 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  section: { gap: 8 },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  segments: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16 },
  account: { gap: 8 },
  delete: { height: 48, alignItems: 'center', justifyContent: 'center' },
  segment: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  segmentFirst: { borderTopLeftRadius: radius.pill, borderBottomLeftRadius: radius.pill },
  segmentLast: { borderTopRightRadius: radius.pill, borderBottomRightRadius: radius.pill },
  segmentNext: { marginLeft: -1 },
});
