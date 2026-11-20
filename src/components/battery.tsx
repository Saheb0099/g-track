import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { batteryIcon, Icon } from '@/components/icon';
import { type as typeStyles, useColors } from '@/lib/theme';

/** A small battery icon with the percentage; red when low. */
export function Battery({ percent }: { percent: number }) {
  const colors = useColors();
  const color = percent <= 20 ? colors.danger : colors.muted;
  return (
    <View style={styles.row} accessibilityLabel={`Battery ${percent} percent`}>
      <Icon name={batteryIcon(percent)} size={16} color={color} style={styles.icon} />
      <Text style={[typeStyles.label, { color, fontSize: 12, lineHeight: 16 }]}>{percent}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  // Material's battery icons stand upright; lying down reads better beside text.
  icon: { transform: [{ rotate: '90deg' }] },
});
