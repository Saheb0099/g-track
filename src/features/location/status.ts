import { getState, setState } from '@/features/location/queue';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type DeviceStatus = Database['public']['Enums']['device_status'];

/** Tells friends whether this phone can share (ok, location off, permission missing). Only writes on change. */
export async function reportStatus(status: DeviceStatus) {
  if ((await getState<DeviceStatus>('reported_status')) === status) return;

  const { data } = await supabase.auth.getSession();
  if (!data.session) return;

  const { error } = await supabase.from('profiles').update({ status }).eq('id', data.session.user.id);
  if (!error) await setState('reported_status', status);
}
