import { Stack } from 'expo-router';

import { useMarkLinkHandled } from '@/features/groups/pending-invite';
import { usePushToken } from '@/features/location/push';
import { useTracking } from '@/features/location/use-tracking';
import { useRestoreAccount } from '@/features/profile/api';
import { useMapIsDark } from '@/features/map/styles';
import { useAppColorScheme } from '@/lib/appearance';
import { fonts, useColors } from '@/lib/theme';

// Opening an invite link from outside the app still puts the map underneath, so Back works.
export const unstable_settings = { anchor: 'index' };

export default function AppLayout() {
  const colors = useColors();
  // Status bar icons: dark on light screens, light on dark ones. The map screens follow the map
  // (a light map stays light in dark mode). Set per screen here rather than with <StatusBar>,
  // so it's applied again on every screen change: on Vivo phones a <StatusBar> on the map
  // stopped taking effect after another screen had been open.
  const themeBar = useAppColorScheme() === 'dark' ? 'light' : 'dark';
  const mapBar = useMapIsDark() ? 'light' : 'dark';
  useMarkLinkHandled();
  useRestoreAccount();
  // While signed in, keep location sharing in step with permissions and the sharing switch.
  useTracking();
  // So friends' "Get location now" can reach this phone.
  usePushToken();

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fonts.medium, fontSize: 22 },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
        statusBarStyle: themeBar,
      }}>
      {/* Full-screen map screens draw their own floating controls. */}
      <Stack.Screen name="index" options={{ headerShown: false, statusBarStyle: mapBar }} />
      <Stack.Screen name="group/[id]/history/[userId]" options={{ headerShown: false, statusBarStyle: mapBar }} />
      <Stack.Screen name="group/[id]/index" options={{ headerShown: false }} />
      <Stack.Screen name="groups" options={{ title: 'Your groups', presentation: 'modal' }} />
      <Stack.Screen name="group/[id]/settings" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings', presentation: 'modal' }} />
      <Stack.Screen name="map-style" options={{ title: 'Map style', presentation: 'modal' }} />
      <Stack.Screen name="about" options={{ title: 'About', presentation: 'modal' }} />
      <Stack.Screen name="setup" options={{ title: 'Location sharing', presentation: 'modal' }} />
      <Stack.Screen name="create-group" options={{ title: 'New group', presentation: 'modal' }} />
      <Stack.Screen name="join/index" options={{ title: 'Join a group', presentation: 'modal' }} />
      <Stack.Screen name="join/[code]" options={{ title: 'Join a group', presentation: 'modal' }} />
    </Stack>
  );
}
