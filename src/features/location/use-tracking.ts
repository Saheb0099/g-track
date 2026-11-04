import { useQuery } from '@tanstack/react-query';
import * as Battery from 'expo-battery';
import { PermissionsAndroid, Platform } from 'react-native';

import { pendingSummary } from '@/features/location/queue';
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

/** Points normally upload within seconds; waiting longer than this means there's no internet. */
const OFFLINE_AFTER_MS = 2 * 60_000;

/** Points still on this phone, and whether they've waited long enough to call it offline. */
export function usePendingUploads() {
  return useQuery({
    queryKey: ['tracking', 'pending'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count, oldest } = await pendingSummary();
      const offline = count > 0 && !!oldest && Date.now() - Date.parse(oldest) > OFFLINE_AFTER_MS;
      return { count, offline };
    },
  });
}
