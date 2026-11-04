import { useQuery } from '@tanstack/react-query';

import type { HistoryPoint } from '@/features/history/timeline';
import { supabase } from '@/lib/supabase';

/** History is kept for 7 days, so the picker offers today and the 6 days before. */
export const HISTORY_DAYS = 7;

export type Day = { start: Date; end: Date; label: string; isToday: boolean };

/** Today and the previous days, in the phone's own time zone, newest first. */
export function recentDays(now = new Date()): Day[] {
  return Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
    const label =
      i === 0
        ? 'Today'
        : i === 1
          ? 'Yesterday'
          : start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
    return { start, end, label, isToday: i === 0 };
  });
}

// The server returns at most 1,000 rows per request, and a group saving every minute makes
// ~1,440 points a day, so a day is read in pages until one comes back empty.
const PAGE_SIZE = 1000;
const MAX_POINTS_PER_DAY = 5000;

export function useDayHistory(userId: string, day: Day) {
  return useQuery({
    queryKey: ['history', userId, day.start.toISOString()],
    // Past days don't change; today gains a point every 5 minutes.
    staleTime: day.isToday ? 60_000 : Infinity,
    queryFn: async (): Promise<HistoryPoint[]> => {
      const points: HistoryPoint[] = [];
      while (points.length < MAX_POINTS_PER_DAY) {
        const { data, error } = await supabase
          .from('locations')
          .select('lat, lng, accuracy_m, recorded_at')
          .eq('user_id', userId)
          .gte('recorded_at', day.start.toISOString())
          .lt('recorded_at', day.end.toISOString())
          .order('recorded_at')
          .range(points.length, points.length + PAGE_SIZE - 1);
        if (error) throw error;
        if (data.length === 0) break;
        for (const row of data) {
          points.push({ lat: row.lat, lng: row.lng, accuracyM: row.accuracy_m, time: Date.parse(row.recorded_at) });
        }
      }
      return points;
    },
  });
}
