import { usePendingUploads, useSetupChecks, useTracking } from '@/features/location/use-tracking';
import { useMyProfile } from '@/features/profile/api';

export type SharingStatus = { label: string; tone: 'ok' | 'attention' | 'off' };

/** One line saying whether your location is being shared, for the people sheet. */
export function useSharingStatus(): SharingStatus | null {
  const profile = useMyProfile();
  const tracking = useTracking();
  const checks = useSetupChecks();
  const pending = usePendingUploads();

  if (!profile.data || !tracking.data) return null;
  const r = tracking.data;
  if (!profile.data.sharing_enabled) return { label: 'Sharing paused', tone: 'off' };
  if (!r.foreground || !r.background) return { label: 'Set up location sharing', tone: 'attention' };
  if (!r.servicesOn) return { label: 'Location is off on this phone', tone: 'attention' };
  if (pending.data?.offline) {
    const n = pending.data.count;
    return { label: `Offline · ${n} point${n === 1 ? '' : 's'} will upload later`, tone: 'attention' };
  }
  // Settings that can stop sharing in the background (Android's battery setting, and phone-maker
  // ones the app can read, like Vivo's sleep standby), counted so the line says plainly what's left.
  const toFix = checks.data
    ? Number(checks.data.batteryOptimized || checks.data.backgroundRestricted) +
      Object.values(checks.data.phone).filter((done) => !done).length
    : 0;
  if (toFix > 0) return { label: `Sharing · ${toFix} setting${toFix === 1 ? '' : 's'} to fix`, tone: 'attention' };
  return { label: "You're sharing", tone: 'ok' };
}
