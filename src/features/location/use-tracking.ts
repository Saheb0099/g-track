import { useQuery } from '@tanstack/react-query';
import * as Battery from 'expo-battery';
import { PermissionsAndroid, Platform } from 'react-native';

import { syncTracking } from '@/features/location/tracking';
import { useMyProfile } from '@/features/profile/api';

/**
 * Keeps tracking in step with the profile's sharing switch and the phone's permissions.
 * As a query it re-runs whenever the app comes to the front (see focusManager in lib/query),
 * which is exactly when permissions may have changed in system settings.
 */
export function useTracking() {
  const profile = useMyProfile();
  const sharing = profile.data?.sharing_enabled;
  return useQuery({
    queryKey: ['tracking', sharing],
    enabled: sharing !== undefined,
    queryFn: () => syncTracking(sharing!),
    staleTime: 60_000,
  });
}

/** Things the checklist needs beyond location permission. */
export function useSetupChecks() {
  return useQuery({
    queryKey: ['tracking', 'setup-checks'],
    staleTime: 0,
    queryFn: async () => {
      const notifications =
        Platform.OS !== 'android' || Platform.Version < 33
          ? true
          : await PermissionsAndroid.check('android.permission.POST_NOTIFICATIONS');
      const batteryOptimized = await Battery.isBatteryOptimizationEnabledAsync().catch(() => false);
      return { notifications, batteryOptimized };
    },
  });
}
