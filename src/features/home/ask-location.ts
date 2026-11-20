import { useEffect, useState } from 'react';

import type { Member } from '@/features/groups/api';
import type { LivePosition } from '@/features/map/api';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/**
 * How long to wait for their phone to answer: waking it, a GPS fix (up to ~26 s indoors) and
 * the upload, with room to spare.
 */
const ANSWER_WAIT_MS = 60_000;
/** "Got a fresh location" stays this long, then the button comes back. */
const DONE_SHOWN_MS = 5_000;

type State = { phase: 'idle' } | { phase: 'asking'; before: string | null } | { phase: 'failed'; message: string };

export type AskPhase = 'idle' | 'asking' | 'done' | 'failed';

/**
 * "Get location now" for one person: wakes their phone (request-location edge function) and
 * waits for a newer position to come in over the live map's subscription.
 */
export function useAskForLocation(member: Member, position: LivePosition | undefined, onAnswered: () => void) {
  const [state, setState] = useState<State>({ phase: 'idle' });
  const recordedAt = position?.recordedAt ?? null;
  const name = member.displayName.split(' ')[0];
  // A newer position than the one from before asking. Compared with that, not with this
  // phone's clock, which may not match theirs.
  const answered = state.phase === 'asking' && recordedAt !== null && recordedAt !== state.before;
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

  // No answer in time.
  useEffect(() => {
    if (state.phase !== 'asking' || answered) return;
    const timer = setTimeout(
      () => setState({ phase: 'failed', message: `Couldn't reach ${name}'s phone. It may be off or offline.` }),
      ANSWER_WAIT_MS,
    );
    return () => clearTimeout(timer);
  }, [state.phase, answered, name]);

  async function ask() {
    setState({ phase: 'asking', before: recordedAt });
    const { data, error } = await supabase.functions.invoke<{ status: string }>('request-location', {
      body: { userId: member.userId },
    });
    if (error) {
      setState({ phase: 'failed', message: friendlyError(await reasonFor(error)) });
    } else if (data?.status === 'no_device') {
      setState({ phase: 'failed', message: `${name}'s phone can't answer yet. They need the latest G Track.` });
    }
    // Otherwise the wake-up is on its way; the answer shows up as a new position.
  }

  return { phase, message: state.phase === 'failed' ? state.message : null, ask };
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
