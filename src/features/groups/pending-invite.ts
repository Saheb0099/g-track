import * as Linking from 'expo-linking';
import { useEffect } from 'react';

import { isValidCode, normalizeCode } from '@/features/groups/api';

// An invite link opened while signed out lands on the sign-in screen (the route guard
// redirects it), so the code is kept here and the join screen opens after sign-in.
let pendingCode: string | null = null;
let lastSeenUrl: string | null = null;

/** The join code in a gtrack://join/CODE link, if any. */
function codeFromUrl(url: string): string | null {
  // Matched on the raw URL: with a custom scheme, "join" may parse as the host rather than the path.
  const match = url.match(/join\/([A-Za-z0-9-]+)/);
  const code = match ? normalizeCode(match[1]) : null;
  return code && isValidCode(code) ? code : null;
}

/** Used on the sign-in screen: remembers an invite link the app was opened with. */
export function useRememberInvite() {
  const url = Linking.useLinkingURL();
  useEffect(() => {
    // Each link counts once, so signing out later doesn't replay an old invite.
    if (!url || url === lastSeenUrl) return;
    lastSeenUrl = url;
    pendingCode = codeFromUrl(url) ?? pendingCode;
  }, [url]);
}

/** Returns the remembered invite code once, then forgets it. */
export function takePendingInvite(): string | null {
  const code = pendingCode;
  pendingCode = null;
  return code;
}

/**
 * Marks the link the app is currently showing as handled, so it isn't remembered again.
 * Used once signed in, where Expo Router has already opened the link itself.
 */
export function useMarkLinkHandled() {
  const url = Linking.useLinkingURL();
  useEffect(() => {
    if (url) lastSeenUrl = url;
  }, [url]);
}
