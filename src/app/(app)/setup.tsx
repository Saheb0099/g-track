import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Location from 'expo-location';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  AppState,
  Linking,
  PermissionsAndroid,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { openAppSettings, openStepPage, phoneSteps, type PhoneStep } from '@/features/location/phone-steps';
import { useSetupChecks, useTracking } from '@/features/location/use-tracking';
import { radius, type as typeStyles, useColors } from '@/lib/theme';

const PACKAGE = Constants.expoConfig?.android?.package ?? 'com.sahebbeshra.gtrack';
// Shown over G Track's app settings, so it's clear where to go there.
const LOCATION_HINT = 'Open Permissions, then Location.';
const BATTERY_HINT = 'Open Battery and choose Unrestricted.';
// Phone-maker steps the app can't check are ticked by hand, and remembered on this phone.
const doneKey = (id: string) => `gtrack.setup.done.${id}`;

function readManualDone(steps: PhoneStep[]): Record<string, boolean> {
  const done: Record<string, boolean> = {};
  for (const step of steps) {
    try {
      done[step.id] = localStorage.getItem(doneKey(step.id)) === 'yes';
    } catch {
      done[step.id] = false;
    }
  }
  return done;
}

export default function LocationSetup() {
  // Edge-to-edge: keep the last item clear of Android's navigation bar.
  const safe = useSafeAreaInsets();
  const colors = useColors();
  const queryClient = useQueryClient();
  const tracking = useTracking();
  const checks = useSetupChecks();
  const phone = phoneSteps();
  const [manualDone, setManualDone] = useState(() => readManualDone(phone.steps));

  const readiness = tracking.data;
  // Re-check everything; the user may have changed settings in another screen.
  const recheck = () => queryClient.invalidateQueries({ queryKey: ['tracking'] });

  // Back from a settings page (or anywhere else): re-check every setting at once, so each step's
  // tick matches what was just changed. Some checks otherwise wait up to a minute to refresh.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void queryClient.invalidateQueries({ queryKey: ['tracking'] });
    });
    return () => sub.remove();
  }, [queryClient]);

  async function allowLocation() {
    const result = await Location.requestForegroundPermissionsAsync();
    if (!result.granted && !result.canAskAgain) {
      Alert.alert('Location is blocked', 'Open app settings → Permissions → Location → Allow.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open settings', onPress: () => openAppSettings(LOCATION_HINT) },
      ]);
    }
    recheck();
  }

  function allowAllTheTime() {
    Alert.alert(
      'Choose "Allow all the time"',
      'Android will open a settings page. Pick "Allow all the time" so G Track can share your location while the app is closed, then come back.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            await Location.requestBackgroundPermissionsAsync();
            recheck();
          },
        },
      ],
    );
  }

  async function allowNotifications() {
    await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
    recheck();
  }

  async function stopBatteryOptimization() {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, {
      data: `package:${PACKAGE}`,
    }).catch(() =>
      IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
    );
    recheck();
  }

  function markDone(id: string, done = true) {
    try {
      if (done) localStorage.setItem(doneKey(id), 'yes');
      else localStorage.removeItem(doneKey(id));
    } catch {
      // Not remembered; harmless.
    }
    setManualDone((all) => ({ ...all, [id]: done }));
  }

  // Permissions can only be turned off by the person, in Android's settings: these open the page.
  const changeLocation = () => openAppSettings(LOCATION_HINT).then(recheck);
  const changeBattery = () => openAppSettings(BATTERY_HINT).then(recheck);
  async function openNotificationSettings() {
    ToastAndroid.show('Use "Allow notifications" to turn them on or off.', ToastAndroid.LONG);
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS, {
      extra: { 'android.provider.extra.APP_PACKAGE': PACKAGE },
    }).catch(() => Linking.openSettings());
    recheck();
  }
  const change = (onPress: () => unknown) => (
    <Button title="Change" variant="secondary" size="small" onPress={onPress} />
  );

  async function openPage(step: PhoneStep) {
    await openStepPage(step);
    recheck();
  }

  const sharingOn = readiness?.tracking && readiness.servicesOn;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingBottom: safe.bottom + 32 }]}>
      <View style={[styles.banner, { backgroundColor: sharingOn ? colors.accentFill : colors.surface }]}>
        <Ionicons
          name={sharingOn ? 'radio' : 'radio-outline'}
          size={24}
          color={sharingOn ? colors.accent : colors.muted}
        />
        <Text style={[typeStyles.body, styles.flex, { color: colors.text }]}>
          {sharingOn
            ? 'Sharing your location. Finish the steps below so it keeps working in the background.'
            : 'Complete the first two steps to start sharing your location with your groups.'}
        </Text>
      </View>

      <Step
        done={!!readiness?.foreground}
        title="1. Location access"
        body="Lets G Track read your location."
        action={<Button title="Allow" onPress={allowLocation} />}
        doneAction={change(changeLocation)}
      />
      <Step
        done={!!readiness?.background}
        title="2. Allow all the time"
        body="Needed to share while the app is closed, about every 5 minutes."
        action={<Button title="Open settings" onPress={allowAllTheTime} disabled={!readiness?.foreground} />}
        doneAction={change(changeLocation)}
      />
      {readiness && !readiness.servicesOn && (
        <Step
          done={false}
          title="Location is turned off"
          body="Turn on Location in the quick settings panel (swipe down from the top)."
        />
      )}
      <Step
        done={!!checks.data?.notifications}
        title="3. Notifications"
        body={'Shows the "G Track is sharing your location" notification, so you always know when sharing is on.'}
        action={<Button title="Allow" onPress={allowNotifications} />}
        doneAction={change(openNotificationSettings)}
      />
      {/* One Android setting with three choices (Unrestricted, Optimized, Restricted): done when
          it's Unrestricted, which also rules out Restricted. */}
      <Step
        done={checks.data ? !checks.data.batteryOptimized && !checks.data.backgroundRestricted : false}
        title="4. Battery: Unrestricted"
        body="Stops Android from pausing or restricting G Track to save battery."
        action={
          checks.data?.backgroundRestricted ? (
            // Android's "don't optimize" prompt can't undo Restricted; that's only in app info → Battery.
            <Button title="App settings" onPress={changeBattery} />
          ) : (
            <Button title="Allow" onPress={stopBatteryOptimization} />
          )
        }
        doneAction={change(changeBattery)}
      />

      {phone.steps.length > 0 && (
        <Text style={[typeStyles.label, styles.section, { color: colors.muted }]}>
          {`${phone.brand.toUpperCase()} SETTINGS`}
        </Text>
      )}
      {phone.steps.map((step, i) => {
        // Checked by the app where the phone allows it, otherwise ticked by hand.
        const auto = checks.data?.phone[step.id];
        const done = auto ?? manualDone[step.id] ?? false;
        return (
          <Step
            key={step.id}
            done={done}
            title={`${5 + i}. ${step.title}`}
            body={step.body}
            action={
              <View style={styles.row}>
                {step.open !== null && <Button title="Open" onPress={() => openPage(step)} style={styles.flex} />}
                {auto === undefined && (
                  <Button title="Done" variant="secondary" onPress={() => markDone(step.id)} style={styles.flex} />
                )}
              </View>
            }
            doneAction={
              <View style={styles.row}>
                {step.open !== null && (
                  <Button
                    title="Change"
                    variant="secondary"
                    size="small"
                    onPress={() => openPage(step)}
                    style={styles.flex}
                  />
                )}
                {auto === undefined && (
                  <Button
                    title="Undo"
                    variant="secondary"
                    size="small"
                    onPress={() => markDone(step.id, false)}
                    style={styles.flex}
                  />
                )}
              </View>
            }
          />
        );
      })}
      <Text
        style={[typeStyles.bodyStrong, styles.guide, { color: colors.accentText }]}
        onPress={() => Linking.openURL(phone.guideUrl)}>
        More help for {phone.brand} phones
      </Text>

      {/* Phones with a "Lock in Recent apps" step already say this. */}
      {!phone.steps.some((step) => step.id === 'lock-recents') && (
        <Text style={[typeStyles.caption, styles.note, { color: colors.muted }]}>
          {"Tip: don't swipe G Track away in Recent apps. On many phones that stops sharing until you open it again."}
        </Text>
      )}
    </ScrollView>
  );
}

// Buttons: blue (primary) for the action that does a step (Allow, Open), grey for the rest
// (Done, Change, Undo), on every step.
function Step({
  done,
  title,
  body,
  action,
  doneAction,
  footer,
}: {
  done: boolean;
  title: string;
  body: string;
  action?: ReactNode;
  /** Shown once done, so a setting is as easy to change back as it was to set. */
  doneAction?: ReactNode;
  footer?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={[styles.step, { backgroundColor: colors.surface }]}>
      <View style={styles.stepHeader}>
        <Ionicons
          name={done ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={done ? colors.success : colors.muted}
        />
        <Text style={[typeStyles.bodyStrong, styles.flex, { color: colors.text, fontSize: 17 }]}>{title}</Text>
      </View>
      <Text style={[typeStyles.body, { color: colors.muted }]}>{body}</Text>
      {done ? doneAction : action}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 48 },
  banner: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    borderRadius: radius.card,
    padding: 16,
  },
  step: { borderRadius: radius.card, padding: 16, gap: 12 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  section: { marginTop: 12, marginLeft: 4 },
  guide: { textAlign: 'center', marginTop: 4 },
  flex: { flex: 1 },
  note: { lineHeight: 19, marginTop: 4, textAlign: 'center' },
});
