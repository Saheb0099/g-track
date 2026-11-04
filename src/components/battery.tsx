import { StyleSheet, Text, View } from 'react-native';

import { type as typeStyles, useColors } from '@/lib/theme';

/** A small battery gauge with the percentage. */
export function Battery({ percent }: { percent: number }) {
  const colors = useColors();
  const fill = percent <= 20 ? colors.warning : colors.success;
  return (
    <View style={styles.row} accessibilityLabel={`Battery ${percent} percent`}>
      <View style={[styles.body, { borderColor: colors.muted }]}>
        <View style={{ width: `${Math.max(8, percent)}%`, height: '100%', borderRadius: 1.5, backgroundColor: fill }} />
      </View>
      <View style={[styles.cap, { backgroundColor: colors.muted }]} />
      <Text style={[typeStyles.caption, { color: colors.muted, fontSize: 13, marginLeft: 4 }]}>{percent}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  body: { width: 18, height: 11, borderWidth: 1.5, borderRadius: 3, padding: 1 },
  cap: { width: 1.6, height: 4, borderRadius: 1, marginLeft: 1 },
});
