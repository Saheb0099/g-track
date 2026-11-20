import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { logEvent } from '@/features/location/queue';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

// "Get location now": a friend's ask arrives as a Firebase data message (see the
// request-location edge function), which wakes the app's background task (task.ts) even when
// it's closed. This file keeps the server told where to send those messages, and shows the
// "<name> asked for your location" notice.

export const LOCATION_REQUEST_TASK = 'gtrack-location-request';
const CHANNEL = 'location-requests';
const TOKEN_KEY = 'gtrack.push-token';

// Notices we post ourselves have a title and show even with the app open. Wake-up messages have
// none and never show (Android would otherwise ask JS whether to show them while open).
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const show = !!notification.request.content.title;
    return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: false, shouldSetBadge: false };
  },
});

/** Quiet (no sound or pop-up), but listed, so nobody is ever asked about without knowing. */
function ensureChannel() {
  return Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Location requests',
    description: 'When a friend asks for your location right now',
    // Exported at runtime; the lint plugin can't follow the package's compiled enum.
    // eslint-disable-next-line import/namespace
    importance: Notifications.AndroidImportance.LOW,
  });
}

/** Tells the person whose phone just answered a friend's ask. */
export async function showRequestNotice(from: string) {
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title: `${from} asked for your location`, body: 'G Track sent where you are now.' },
    trigger: { channelId: CHANNEL },
  });
}

function rememberedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function saveToken(token: string) {
  const { error } = await supabase.rpc('save_push_token', { p_token: token });
  if (error) throw error;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Saved again next time the app opens; harmless.
  }
}

/**
 * While signed in: gives the server this phone's token (again on every start, which also marks
 * it as still in use) and follows Google replacing it.
 */
export function usePushToken() {
  useEffect(() => {
    ensureChannel()
      .then(() => Notifications.getDevicePushTokenAsync())
      .then(({ data }) => saveToken(String(data)))
      // No Firebase set up for this build, or offline: asks just can't reach this phone yet.
      .catch((e) => logEvent(`push token not saved: ${errorMessage(e)}`).catch(() => {}));
    const sub = Notifications.addPushTokenListener(({ data }) => {
      void saveToken(String(data)).catch(() => {});
    });
    return () => sub.remove();
  }, []);
}

/** Signing out: this phone stops answering asks for the account. Needs the session, so call it first. */
export async function forgetPushToken() {
  const token = rememberedToken();
  if (!token) return;
  await supabase.rpc('remove_push_token', { p_token: token });
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to forget.
  }
}

/** Who asked, from a background task payload; null if it isn't an ask. */
export function readLocationRequest(payload: unknown): { from: string } | null {
  // expo-notifications passes the message's "body" field as a JSON string named dataString;
  // searched for rather than read at a fixed path, which differs between app states.
  const dataString = findKey(payload, 'dataString', 4);
  if (typeof dataString !== 'string') return null;
  try {
    const data = JSON.parse(dataString) as { type?: unknown; from?: unknown };
    if (data.type !== 'location_request') return null;
    return { from: typeof data.from === 'string' && data.from ? data.from : 'A friend' };
  } catch {
    return null;
  }
}

function findKey(value: unknown, key: string, depth: number): unknown {
  if (depth < 0 || typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record[key] === 'string') return record[key];
  for (const child of Object.values(record)) {
    const found = findKey(child, key, depth - 1);
    if (found !== undefined) return found;
  }
  return undefined;
}
