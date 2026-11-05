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
  if (checks.data?.backgroundRestricted) return { label: 'Background use is restricted', tone: 'attention' };
  if (checks.data?.batteryOptimized) return { label: "You're sharing · finish battery setup", tone: 'attention' };
  // A phone-maker setting the app could check (e.g. Vivo's sleep standby) is still in the way.
  if (checks.data && Object.values(checks.data.phone).some((done) => !done)) {
    return { label: "You're sharing · finish phone setup", tone: 'attention' };
  }
  return { label: "You're sharing", tone: 'ok' };
}
