import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { resetTracking } from '@/features/location/tracking';
import { queryClient } from '@/lib/query';
import { supabase } from '@/lib/supabase';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// The Web client ID makes Google include an ID token, which Supabase verifies.
GoogleSignin.configure({ webClientId });

// Android reports a package/SHA-1 mismatch with the Google Cloud client as code 10.
const DEVELOPER_ERROR = '10';

type AuthState = { session: Session | null; loading: boolean };

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setState({ session: data.session, loading: false }))
      // A broken stored session shouldn't leave the splash screen up forever; show sign-in instead.
      .catch(() => setState({ session: null, loading: false }));

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Covers every way a session ends (sign-out, expired refresh token), not just the button.
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        // Stop sharing, and drop unsent points so they can't upload under the next account.
        void resetTracking().catch(() => {});
      }
      setState({ session, loading: false });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Opens Google's account picker and signs in to Supabase. Throws with a readable message. */
export async function signInWithGoogle(): Promise<'signed-in' | 'cancelled'> {
  if (!webClientId) {
    throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing from .env.local.');
  }

  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      return 'cancelled';
    }

    const { idToken } = response.data;
    if (!idToken) {
      throw new Error('Google did not return an ID token. Check the Web client ID.');
    }

    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) {
      throw new Error(`Supabase rejected the sign-in: ${error.message}`);
    }
    return 'signed-in';
  } catch (error) {
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.IN_PROGRESS:
          throw new Error('Sign-in is already in progress.');
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new Error('Google Play services is missing or out of date on this phone.');
        case DEVELOPER_ERROR:
          throw new Error(
            "Google rejected this app build. The Android client's package name or SHA-1 in Google Cloud doesn't match.",
          );
      }
    }
    throw error;
  }
}

export async function signOut() {
  // Forget the Google account too, so the picker shows next time.
  await GoogleSignin.signOut().catch(() => {});
  // Clears the stored session even when offline; the SIGNED_OUT event then clears cached data.
  await supabase.auth.signOut();
}

/**
 * Schedules the account for deletion in 7 days, then signs out. Signing in again before then
 * cancels it (see useRestoreAccount).
 */
export async function deleteAccount() {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await signOut();
}
