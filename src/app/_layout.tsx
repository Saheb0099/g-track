import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { LogBox, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/lib/auth';
import { QueryProvider } from '@/lib/query';

SplashScreen.preventAutoHideAsync();

// @gorhom/bottom-sheet passes dependency arrays to Reanimated, which only uses them on the web;
// the warning is harmless and would otherwise cover the sheet during development.
LogBox.ignoreLogs(['[Reanimated] Dependencies should only be used on the web']);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryProvider>
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const colorScheme = useColorScheme();
  const { session, loading } = useAuth();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  // A font that fails to load falls back to the system font rather than blocking the app.
  const ready = !loading && (fontsLoaded || !!fontError);

  // Keep the splash screen up until we know who is signed in and the fonts are in.
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        {/* Everything in (app) needs a signed-in user. */}
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
