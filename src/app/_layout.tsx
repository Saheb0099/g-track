import { MaterialSymbols_400Regular } from '@expo-google-fonts/material-symbols/400Regular';
import { MaterialSymbols_400Regular_Filled } from '@expo-google-fonts/material-symbols/400Regular_Filled';
import { Roboto_400Regular } from '@expo-google-fonts/roboto/400Regular';
import { Roboto_500Medium } from '@expo-google-fonts/roboto/500Medium';
import { useFonts } from 'expo-font';
import { NavigationBar } from 'expo-navigation-bar';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { applySavedTheme, useAppColorScheme } from '@/lib/appearance';
import { AuthProvider, useAuth } from '@/lib/auth';
import { QueryProvider } from '@/lib/query';

SplashScreen.preventAutoHideAsync();
applySavedTheme();

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
  const colorScheme = useAppColorScheme();
  const { session, loading } = useAuth();
  // Roboto for text and Material Symbols for icons.
  const [fontsLoaded, fontError] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    MaterialSymbols_400Regular,
    MaterialSymbols_400Regular_Filled,
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
      {/* Android's navigation buttons follow G Track's theme (including a chosen Light or Dark),
          not the phone's: light buttons in dark mode, dark ones in light mode. */}
      <NavigationBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      {/* Status bar icons follow the theme here (sign-in); the app's own screens set theirs in
          the (app) layout. */}
      <Stack screenOptions={{ headerShown: false, statusBarStyle: colorScheme === 'dark' ? 'light' : 'dark' }}>
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
