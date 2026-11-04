import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Location from 'expo-location';
import { useState, type ReactNode } from 'react';
import { Alert, Linking, PermissionsAndroid, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { brandTip } from '@/features/location/brand-tips';
import { useSetupChecks, useTracking } from '@/features/location/use-tracking';
import { useColors } from '@/lib/theme';

const PACKAGE = Constants.expoConfig?.android?.package ?? 'com.sahebbeshra.gtrack';
const BRAND_DONE_KEY = 'gtrack.setup.brand-done';

function readBrandDone() {
  try {
    return localStorage.getItem(BRAND_DONE_KEY) === 'yes';
  } catch {
    return false;
  }
}

export default function LocationSetup() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const tracking = useTracking();
  const checks = useSetupChecks();
  const tip = brandTip();
  const [brandDone, setBrandDone] = useState(readBrandDone);

  const readiness = tracking.data;
  // Re-check everything; the user may have changed settings in another screen.
  const recheck = () => queryClient.invalidateQueries({ queryKey: ['tracking'] });

  async function allowLocation() {
    const result = await Location.requestForegroundPermissionsAsync();
    if (!result.granted && !result.canAskAgain) {
      Alert.alert('Location is blocked', 'Open app settings → Permissions → Location → Allow.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
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

  function markBrandDone() {
    try {
      localStorage.setItem(BRAND_DONE_KEY, 'yes');
    } catch {
      // Not remembered; harmless.
    }
    setBrandDone(true);
  }

  const sharingOn = readiness?.tracking && readiness.servicesOn;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={[styles.banner, { borderColor: sharingOn ? colors.accent : colors.border }]}>
        <Ionicons name={sharingOn ? 'radio' : 'radio-outline'} size={24} color={sharingOn ? colors.accent : colors.muted} />
        <Text style={[styles.bannerText, { color: colors.text }]}>
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
      />
      <Step
        done={!!readiness?.background}
        title="2. Allow all the time"
        body="Needed to share while the app is closed, about every 5 minutes."
        action={<Button title="Open settings" onPress={allowAllTheTime} disabled={!readiness?.foreground} />}
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
        action={<Button title="Allow" variant="secondary" onPress={allowNotifications} />}
      />
      <Step
        done={checks.data ? !checks.data.batteryOptimized : false}
        title="4. Battery: don't optimize"
        body="Stops Android from pausing G Track to save battery."
        action={<Button title="Allow" variant="secondary" onPress={stopBatteryOptimization} />}
      />
      <Step
        done={brandDone}
        title={`5. ${tip.brand} battery settings`}
        body={tip.steps.map((s) => `• ${s}`).join('\n')}
        action={
          <View style={styles.row}>
            <Button title="App settings" variant="secondary" onPress={() => Linking.openSettings()} style={styles.flex} />
            <Button title="I've done this" variant="secondary" onPress={markBrandDone} style={styles.flex} />
          </View>
        }
        footer={
          <Text style={[styles.link, { color: colors.accent }]} onPress={() => Linking.openURL(tip.guideUrl)}>
            Step-by-step guide for {tip.brand} phones
          </Text>
        }
      />

      <Text style={[styles.note, { color: colors.muted }]}>
        {"Tip: don't swipe G Track away in Recent apps. On many phones that stops sharing until you open it again."}
      </Text>
    </ScrollView>
  );
}

function Step({
  done,
  title,
  body,
  action,
  footer,
}: {
  done: boolean;
  title: string;
  body: string;
  action?: ReactNode;
  footer?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={[styles.step, { borderColor: colors.border }]}>
      <View style={styles.stepHeader}>
        <Ionicons
          name={done ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={done ? colors.accent : colors.muted}
        />
        <Text style={[styles.stepTitle, { color: colors.text }]}>{title}</Text>
      </View>
      <Text style={[styles.stepBody, { color: colors.muted }]}>{body}</Text>
      {!done && action}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 48 },
  banner: { flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 14 },
  bannerText: { flex: 1, fontSize: 15, lineHeight: 21 },
  step: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepTitle: { fontSize: 17, fontWeight: '700', flex: 1 },
  stepBody: { fontSize: 15, lineHeight: 22 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  link: { fontSize: 15, fontWeight: '600' },
  note: { fontSize: 14, lineHeight: 20, marginTop: 4 },
});
