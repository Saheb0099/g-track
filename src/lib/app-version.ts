import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';

import { supabase } from '@/lib/supabase';

/** This copy of the app, from app.json (expo.version and android.versionCode). */
export const APP_VERSION = Constants.expoConfig?.version ?? '?';
const APP_VERSION_CODE = Constants.expoConfig?.android?.versionCode ?? 0;

/**
 * The newer release's name ("1.0.1") when one is out, else null. Friends install the APK by
 * hand, so this is the only way they hear about updates (see the app_config migration).
 */
export function useUpdateAvailable(): string | null {
  const latest = useQuery({
    queryKey: ['app-config'],
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_config')
        .select('latest_version_code, latest_version_name')
        .single();
      if (error) throw error;
      return data;
    },
  });
  return latest.data && latest.data.latest_version_code > APP_VERSION_CODE ? latest.data.latest_version_name : null;
}
