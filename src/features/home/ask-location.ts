import { useEffect, useState } from 'react';

import type { Member } from '@/features/groups/api';
import type { LivePosition } from '@/features/map/api';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/**
 * How long to wait for their phone to answer: waking it, a GPS fix (up to ~26 s indoors) and
 * the upload, with room to spare.
 */
const ANSWER_WAIT_MS = 60_000;
/** "Got a fresh location" stays this long, then the button comes back. */
const DONE_SHOWN_MS = 5_000;
/** The server's wait between asks to the same person (request_location), counted down here. */
export const ASK_AGAIN_MS = 2 * 60_000;

// When you last asked each person on this phone, so the countdown survives closing the card or
// the app. Per signed-in account too, as the server's wait is: another account signed in here
// starts with no wait.
const askedKey = (meId: string, userId: string) => `gtrack.asked.${meId}.${userId}`;

function readAskedAt(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeAskedAt(key: string, at: number | null) {
  try {
    if (at === null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(at));
  } catch {
    // Not remembered; the server still enforces the wait.
  }
}

/** "1:45" for a countdown. */
export function countdown(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// `before` is their position's time when asking. A failed ask that timed out keeps it, so an
// answer that arrives late still counts.
type State =
  | { phase: 'idle' }
  | { phase: 'asking'; before: string | null }
  | { phase: 'failed'; message: string; before?: string | null };

export type AskPhase = 'idle' | 'asking' | 'done' | 'failed';

/**
 * "Get location now" for one person: wakes their phone (request-location edge function) and
 * waits for a newer position to come in over the live map's subscription.
 */
export function useAskForLocation(member: Member, position: LivePosition | undefined, onAnswered: () => void) {
  const [state, setState] = useState<State>({ phase: 'idle' });
  const key = askedKey(useAuth().session?.user.id ?? 'none', member.userId);
  const [askedAt, setAskedAt] = useState(() => readAskedAt(key));
  const [now, setNow] = useState(() => Date.now());
  /** Time left before this person can be asked again. */
  const waitMs = Math.max(0, askedAt + ASK_AGAIN_MS - now);
  const waiting = waitMs > 0;
  const recordedAt = position?.recordedAt ?? null;
  const name = member.displayName.split(' ')[0];
  // A newer position than the one from before asking. Compared with that, not with this
  // phone's clock, which may not match theirs. After "Couldn't reach" a late answer still
  // counts, but only until they can be asked again: later, it's just their usual update.
  const before = state.phase === 'idle' ? undefined : state.before;
  const answered =
    before !== undefined && (state.phase === 'asking' || waiting) && recordedAt !== null && recordedAt !== before;
  const phase: AskPhase = answered ? 'done' : state.phase;

  // Answered: show them on the map, and after a moment offer the button again.
  useEffect(() => {
    if (!answered) return;
    onAnswered();
    const timer = setTimeout(() => setState({ phase: 'idle' }), DONE_SHOWN_MS);
    return () => clearTimeout(timer);
    // Only when the answer arrives, not each time the parent passes a new callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered]);

  // Count down to asking again, once a second.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waiting]);

  // No answer in time.
  useEffect(() => {
    if (state.phase !== 'asking' || answered) return;
    const timer = setTimeout(
      () =>
        setState((s) =>
          s.phase === 'asking'
            ? { phase: 'failed', message: `Couldn't reach ${name}'s phone. It may be off or offline.`, before: s.before }
            : s,
        ),
      ANSWER_WAIT_MS,
    );
    return () => clearTimeout(timer);
  }, [state.phase, answered, name]);

  function startWait(at: number | null) {
    setAskedAt(at ?? 0);
    setNow(Date.now());
    writeAskedAt(key, at);
  }

  async function ask() {
    setState({ phase: 'asking', before: recordedAt });
    startWait(Date.now());
    const { data, error } = await supabase.functions.invoke<{ status: string }>('request-location', {
      body: { userId: member.userId },
    });
    if (error) {
      const reason = await reasonFor(error);
      // The server only counts an ask that passed its checks; a refused one (not sharing, offline)
      // starts no wait. A send that failed, or "asked recently", does.
      if (reason !== 'send_failed' && reason !== 'asked_recently') startWait(null);
      setState({ phase: 'failed', message: friendlyError(reason) });
    } else if (data?.status === 'no_device') {
      setState({ phase: 'failed', message: `${name}'s phone can't answer yet. They need the latest G Track.` });
    }
    // Otherwise the wake-up is on its way; the answer shows up as a new position.
  }

  return { phase, message: phase === 'failed' && state.phase === 'failed' ? state.message : null, waitMs, ask };
}

/** The function's own error key ("asked_recently") from its reply, if it sent one. */
async function reasonFor(error: unknown): Promise<unknown> {
  // Checked by shape, not `instanceof Response`: React Native's fetch Response isn't always the
  // global one, and the check then fails silently, leaving only "non-2xx status code".
  const reply = (error as { context?: { status?: number; text?: () => Promise<string> } }).context;
  if (typeof reply?.text !== 'function') return error;
  try {
    const text = await reply.text();
    try {
      const body = JSON.parse(text) as { error?: unknown };
      if (typeof body.error === 'string') return body.error;
    } catch {
      // Not JSON (a crash page or gateway error): show what came back.
    }
    return `Server error ${reply.status ?? ''}: ${text.slice(0, 120)}`;
  } catch {
    return error;
  }
}
