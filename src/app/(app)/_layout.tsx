import { Stack } from 'expo-router';

import { useMarkLinkHandled } from '@/features/groups/pending-invite';
import { useTracking } from '@/features/location/use-tracking';

// Opening an invite link from outside the app still puts "My groups" underneath, so Back works.
export const unstable_settings = { anchor: 'index' };

export default function AppLayout() {
  useMarkLinkHandled();
  // While signed in, keep location sharing in step with permissions and the sharing switch.
  useTracking();
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'My groups' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="setup" options={{ title: 'Location sharing' }} />
      <Stack.Screen name="create-group" options={{ title: 'New group', presentation: 'modal' }} />
      <Stack.Screen name="join/index" options={{ title: 'Join a group', presentation: 'modal' }} />
      <Stack.Screen name="join/[code]" options={{ title: 'Join a group' }} />
      <Stack.Screen name="group/[id]/index" options={{ title: '' }} />
      <Stack.Screen name="group/[id]/settings" options={{ title: 'Group settings' }} />
      <Stack.Screen name="group/[id]/history/[userId]" options={{ title: 'History' }} />
    </Stack>
  );
}
