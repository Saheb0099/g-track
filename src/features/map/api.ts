import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId } from 'react';

import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type LatestRow = Database['public']['Tables']['latest_locations']['Row'];

export type LivePosition = {
  userId: string;
  lat: number;
  lng: number;
  accuracyM: number | null;
  recordedAt: string;
  batteryPct: number | null;
  source: LatestRow['source'];
};

function toPosition(row: LatestRow): LivePosition {
  return {
    userId: row.user_id,
    lat: row.lat,
    lng: row.lng,
    accuracyM: row.accuracy_m,
    recordedAt: row.recorded_at,
    batteryPct: row.battery_pct,
    source: row.source,
  };
}

const liveKey = (groupId: string) => ['group', groupId, 'live'] as const;

/**
 * Latest position of each member who is sharing, kept current over Supabase Realtime.
 * The database only returns (and only streams) positions this user may see; paused members
 * simply have none.
 */
export function useLivePositions(groupId: string, memberIds: string[]) {
  const queryClient = useQueryClient();
  // The client hands back an existing channel of the same name, so two screens showing one
  // group (the map, and group settings over it) would share, and closing one would cut both off.
  const instance = useId();
  // Sorted, so the subscription below doesn't restart when the member order changes.
  const ids = [...memberIds].sort();
  const idList = ids.join(',');

  const query = useQuery({
    queryKey: [...liveKey(groupId), idList],
    enabled: ids.length > 0,
    queryFn: async (): Promise<LivePosition[]> => {
      const { data, error } = await supabase
        .from('latest_locations')
        .select('user_id, lat, lng, accuracy_m, speed, heading, source, battery_pct, recorded_at')
        .in('user_id', ids);
      if (error) throw error;
      return data.map(toPosition);
    },
  });

  useEffect(() => {
    if (!idList) return;
    const key = [...liveKey(groupId), idList];
    const refetchAll = () => {
      queryClient.invalidateQueries({ queryKey: liveKey(groupId) });
      queryClient.invalidateQueries({ queryKey: ['group', groupId, 'members'] });
    };

    const channel = supabase
      .channel(`live:${groupId}:${instance}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'latest_locations', filter: `user_id=in.(${idList})` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const gone = (payload.old as Partial<LatestRow>).user_id;
            queryClient.setQueryData<LivePosition[]>(key, (list) => list?.filter((p) => p.userId !== gone));
            return;
          }
          const next = toPosition(payload.new as LatestRow);
          queryClient.setQueryData<LivePosition[]>(key, (list = []) => [
            ...list.filter((p) => p.userId !== next.userId),
            next,
          ]);
        },
      )
      // Pausing, location turned off, a new upload time: refresh the list and who is visible.
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=in.(${idList})` },
        refetchAll,
      )
      // Someone joined, left or was removed.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` },
        refetchAll,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, idList, instance, queryClient]);

  return query;
}
