import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { radius, type as typeStyles, useColors } from '@/lib/theme';

/** A rounded group, for lists and blocks of controls. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.surface }, style]}>{children}</View>;
}

/** Heading above a card, in the primary colour. */
export function SectionLabel({ children }: { children: string }) {
  const colors = useColors();
  return <Text style={[typeStyles.label, styles.label, { color: colors.accentText }]}>{children}</Text>;
}

/**
 * Material's inset divider between rows in a card: a hairline that starts where the row's text
 * does (past a 40 pt avatar or icon by default) and stops short of the right edge.
 */
export function RowDivider({ inset = 72 }: { inset?: number }) {
  const colors = useColors();
  return (
    <View
      style={{ height: StyleSheet.hairlineWidth, marginLeft: inset, marginRight: 16, backgroundColor: colors.border }}
    />
  );
}

/** A labelled number tile (Updated / Accuracy / Battery, places / km). */
export function StatTile({ label, value, valueColor }: { label: string; value: ReactNode; valueColor?: string }) {
  const colors = useColors();
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface }]}>
      <Text style={[typeStyles.label, { color: colors.muted, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 }]}>
        {label}
      </Text>
      {typeof value === 'string' ? (
        <Text style={[typeStyles.bodyStrong, { color: valueColor ?? colors.text }]} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, overflow: 'hidden' },
  label: { paddingHorizontal: 4 },
  tile: { flex: 1, borderRadius: radius.tile, paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
});
