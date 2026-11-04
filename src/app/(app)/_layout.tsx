import { Stack } from "expo-router";

import { useMarkLinkHandled } from "@/features/groups/pending-invite";
import { useTracking } from "@/features/location/use-tracking";
import { fonts, useColors } from "@/lib/theme";

// Opening an invite link from outside the app still puts the map underneath, so Back works.
export const unstable_settings = { anchor: "index" };

export default function AppLayout() {
  const colors = useColors();
  useMarkLinkHandled();
  // While signed in, keep location sharing in step with permissions and the sharing switch.
  useTracking();

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 18 },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {/* Full-screen map screens draw their own floating controls. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="group/[id]/history/[userId]"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="group/[id]/index" options={{ headerShown: false }} />
      <Stack.Screen
        name="groups"
        options={{ title: "Your groups", presentation: "modal" }}
      />
      <Stack.Screen
        name="group/[id]/settings"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="settings"
        options={{ title: "Settings", presentation: "modal" }}
      />
      <Stack.Screen
        name="setup"
        options={{ title: "Location sharing", presentation: "modal" }}
      />
      <Stack.Screen
        name="create-group"
        options={{ title: "New group", presentation: "modal" }}
      />
      <Stack.Screen
        name="join/index"
        options={{ title: "Join a group", presentation: "modal" }}
      />
      <Stack.Screen
        name="join/[code]"
        options={{ title: "Join a group", presentation: "modal" }}
      />
    </Stack>
  );
}
