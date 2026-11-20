// Wakes a friend's phone so it sends where it is right now ("Get location now").
//
// 1. request_location() runs as the caller: it checks they may ask this person (shared group,
//    sharing, not asked in the last 2 minutes) and logs the ask.
// 2. The friend's phone tokens are read with the service role and each phone gets a
//    high-priority Firebase data message. The app answers it in the background (see
//    src/features/location/task.ts), even when it's closed.
//
// Secret: FIREBASE_SERVICE_ACCOUNT, the Firebase service account key file's JSON
//   supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat path/to/key.json)"

import { createClient } from 'npm:@supabase/supabase-js@2';

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'not_authenticated' }, 401);

  let userId: unknown;
  try {
    ({ userId } = await req.json());
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (typeof userId !== 'string') return json({ error: 'bad_request' }, 400);

  // As the caller, so the database's rules decide (and a bad token is turned away there).
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: askerName, error } = await asCaller.rpc('request_location', { p_user_id: userId });
  if (error) return json({ error: error.message }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: tokens, error: tokenError } = await admin.from('push_tokens').select('token').eq('user_id', userId);
  if (tokenError) return json({ error: 'server_error' }, 500);
  // Their app is older than this feature, or they haven't opened it since updating.
  if (!tokens || tokens.length === 0) return json({ status: 'no_device' });

  let sent = 0;
  try {
    for (const { token } of tokens) {
      const result = await sendWakeUp(token, String(askerName ?? 'A friend'));
      if (result === 'sent') sent++;
      // The app was uninstalled, or the phone got a new token: forget this one.
      if (result === 'gone') await admin.from('push_tokens').delete().eq('token', token);
    }
  } catch (e) {
    // Firebase unreachable, or its key missing or wrong.
    console.error('Sending the wake-up failed', e);
    return json({ error: 'send_failed' }, 502);
  }
  return json({ status: sent > 0 ? 'sent' : 'no_device' });
});

/** One data message to one phone. Data-only (no notification block), so the app's own code runs. */
async function sendWakeUp(token: string, from: string): Promise<'sent' | 'gone' | 'failed'> {
  const account = serviceAccount();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        // expo-notifications hands "body" (a JSON string) to the app's task as dataString. Keys
        // named "title" or "message" would make it show a notification itself; none are sent.
        data: { body: JSON.stringify({ type: 'location_request', from }) },
        // High priority wakes a sleeping phone; an ask older than a minute isn't worth answering.
        android: { priority: 'HIGH', ttl: '60s' },
      },
    }),
  });
  if (response.ok) return 'sent';
  const body = await response.text();
  if (response.status === 404 || body.includes('UNREGISTERED')) return 'gone';
  console.error('FCM send failed', response.status, body);
  return 'failed';
}

let account: ServiceAccount | null = null;
function serviceAccount(): ServiceAccount {
  account ??= JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? 'null');
  if (!account) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  return account;
}

// Google access tokens last an hour; reuse one until shortly before it runs out.
let cached: { token: string; expiresAt: number } | null = null;

/** An OAuth access token for FCM, from a JWT signed with the service account's key. */
async function accessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;
  const { client_email, private_key } = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const jwt = `${header}.${claims}.${base64url(new Uint8Array(signature))}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!response.ok) throw new Error(`Google token request failed: ${response.status}`);
  const { access_token, expires_in } = await response.json();
  cached = { token: access_token, expiresAt: Date.now() + expires_in * 1000 };
  return access_token;
}

function pemToBytes(pem: string): Uint8Array {
  const base64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function base64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
