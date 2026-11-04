import { Stack } from 'expo-router';

// Opening an invite link from outside the app still puts "My groups" underneath, so Back works.
export const unstable_settings = { anchor: 'index' };

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'My groups' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="create-group" options={{ title: 'New group', presentation: 'modal' }} />
      <Stack.Screen name="join/index" options={{ title: 'Join a group', presentation: 'modal' }} />
      <Stack.Screen name="join/[code]" options={{ title: 'Join a group' }} />
      <Stack.Screen name="group/[id]/index" options={{ title: '' }} />
      <Stack.Screen name="group/[id]/settings" options={{ title: 'Group settings' }} />
    </Stack>
  );
}
