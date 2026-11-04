import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { setCurrentGroup } from '@/features/groups/current-group';
import { useColors } from '@/lib/theme';

/**
 * A group is shown on the home map. This route (reached after creating or joining a group,
 * or from an old link) makes it the current group and goes back to the map.
 */
export default function OpenGroup() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    if (id) setCurrentGroup(id);
    router.dismissTo('/');
  }, [id]);

  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}
