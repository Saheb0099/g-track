import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, sharing_enabled, status, deleted_at')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

type Profile = Awaited<ReturnType<typeof fetchProfile>>;

export function useMyProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: () => fetchProfile(userId!),
  });
}

/**
 * Turns sharing on or off. Paused, friends no longer see where you are now and nothing new is
 * recorded, but the history you already have stays. Tracking follows through useTracking.
 */
export function useSetSharing() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const client = useQueryClient();
  const key = ['profile', userId];
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from('profiles').update({ sharing_enabled: enabled }).eq('id', userId!);
      if (error) throw error;
    },
    // Flip the switch at once; a failure puts it back. Restored from memory, not by re-reading
    // the server, which fails too when offline and would leave the phone paused on its own.
    onMutate: (enabled) => {
      const before = client.getQueryData<Profile>(key);
      client.setQueryData<Profile>(key, (p) => p && { ...p, sharing_enabled: enabled });
      return { before };
    },
    onError: (_error, _enabled, context) => {
      if (context?.before) client.setQueryData<Profile>(key, context.before);
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
}

/** Signing in again within the 7 days cancels a scheduled deletion, putting everything back. */
export function useRestoreAccount() {
  const profile = useMyProfile();
  const client = useQueryClient();
  const scheduled = !!profile.data?.deleted_at;
  useEffect(() => {
    if (!scheduled) return;
    void supabase.rpc('restore_my_account').then(({ data, error }) => {
      // On failure the profile still says "scheduled", so the next load tries again.
      if (error) return;
      void client.invalidateQueries();
      if (data) Alert.alert('Welcome back', 'Your account will not be deleted.');
    });
  }, [scheduled, client]);
}

/** The name people in your groups see. Starts as your Google name. */
export function useSetDisplayName() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['profile', userId] });
      // Member lists show the name too.
      void client.invalidateQueries({ queryKey: ['group'] });
    },
  });
}
