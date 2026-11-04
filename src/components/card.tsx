import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, type as typeStyles, useColors } from '@/lib/theme';

/** A white rounded group, for lists and blocks of controls. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.surface }, style]}>{children}</View>;
}

/** Small uppercase heading above a card. */
export function SectionLabel({ children }: { children: string }) {
  const colors = useColors();
  return <Text style={[typeStyles.label, { color: colors.muted }]}>{children.toUpperCase()}</Text>;
}

/** Hairline between rows in a card, inset past the avatar. */
export function RowDivider({ inset = 68 }: { inset?: number }) {
  const colors = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: inset }} />;
}

/** A labelled number tile (Updated / Accuracy / Battery, places / km). */
export function StatTile({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const colors = useColors();
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface }]}>
      <Text style={[typeStyles.caption, { color: colors.muted, fontSize: 12 }]}>{label}</Text>
      <Text style={[typeStyles.bodyStrong, { fontSize: 17, color: valueColor ?? colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, overflow: 'hidden' },
  tile: { flex: 1, borderRadius: radius.tile, paddingHorizontal: 12, paddingVertical: 10, gap: 3 },
});
