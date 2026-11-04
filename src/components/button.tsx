import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { type as typeStyles, useColors, type Colors } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'strong';

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  size?: 'large' | 'small';
  style?: StyleProp<ViewStyle>;
};

function palette(colors: Colors, variant: Variant) {
  switch (variant) {
    case 'primary':
      return { bg: colors.accent, fg: colors.onAccent };
    case 'strong':
      return { bg: colors.strong, fg: colors.onStrong };
    case 'danger':
      return { bg: colors.dangerFill, fg: colors.danger };
    case 'secondary':
      return { bg: colors.fill, fg: colors.text };
  }
}

/** A pill button. */
export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, size = 'large', style }: Props) {
  const colors = useColors();
  const { bg, fg } = palette(colors, variant);
  const inactive = disabled || loading;
  const height = size === 'large' ? 52 : 38;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        { height, borderRadius: height / 2, backgroundColor: bg, opacity: inactive ? 0.45 : pressed ? 0.75 : 1 },
        size === 'small' && styles.small,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[typeStyles.button, size === 'small' && styles.smallText, { color: fg }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  small: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallText: { fontSize: 14 },
});
