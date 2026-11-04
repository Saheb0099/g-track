import { peek, remove } from '@/features/location/queue';
import { supabase } from '@/lib/supabase';

const BATCH_SIZE = 100;
// Enough to clear about two days of backlog in one go; the rest goes on the next run.
const MAX_BATCHES = 10;

let inFlight: Promise<void> | null = null;

/** Uploads queued points, oldest first. Safe to call often: overlapping calls share one upload. */
export function flushQueue(): Promise<void> {
  inFlight ??= upload().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function upload() {
  // getSession refreshes an expired token, which matters in the background where auto-refresh is off.
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;

  for (let i = 0; i < MAX_BATCHES; i++) {
    const batch = await peek(BATCH_SIZE);
    if (batch.length === 0) return;

    // user_id comes from the signed-in user on the server. Retried points hit the unique
    // (user_id, recorded_at) key and are skipped, so a batch can safely be sent twice.
    const { error } = await supabase
      .from('locations')
      .upsert(batch, { onConflict: 'user_id,recorded_at', ignoreDuplicates: true });
    if (error) throw error;

    await remove(batch.map((point) => point.recorded_at));
  }
}
