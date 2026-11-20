import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { Icon, type IconName } from '@/components/icon';
import { type as typeStyles, useColors, type Colors } from '@/lib/theme';

/**
 * Material 3 buttons: primary is filled, secondary is tonal, outlined and text are quieter,
 * danger is outlined in red, and strong is a tonal button in its selected state.
 */
type Variant = 'primary' | 'secondary' | 'outlined' | 'text' | 'danger' | 'strong';

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  /** Can't be pressed but keeps its colours: a confirmation ("Got a fresh location"), not a dead button. */
  readOnly?: boolean;
  /** A Material Symbol before the title, coloured to match; or any element. */
  icon?: IconName | ReactNode;
  size?: 'large' | 'small';
  style?: StyleProp<ViewStyle>;
};

function palette(colors: Colors, variant: Variant) {
  switch (variant) {
    case 'primary':
      return { bg: colors.accent, fg: colors.onAccent, border: undefined };
    case 'secondary':
      return { bg: colors.tonal, fg: colors.onTonal, border: undefined };
    case 'strong':
      return { bg: colors.accentFill, fg: colors.onAccentFill, border: undefined };
    case 'outlined':
      return { bg: 'transparent', fg: colors.accent, border: colors.outline };
    case 'text':
      return { bg: 'transparent', fg: colors.accent, border: undefined };
    case 'danger':
      return { bg: 'transparent', fg: colors.danger, border: colors.danger };
  }
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  readOnly,
  icon,
  size = 'large',
  style,
}: Props) {
  const colors = useColors();
  const { bg, fg, border } = palette(colors, variant);
  // Faded only when it's unavailable; a read-only button just can't be pressed.
  const inactive = (disabled || loading) && !readOnly;
  const height = size === 'large' ? 48 : 40;
  // Material's disabled look: the content and container fade, whatever the variant.
  const content = inactive && !loading ? colors.text : fg;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive || readOnly}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive || readOnly, busy: loading }}
      android_ripple={{ color: `${fg}33`, borderless: false, foreground: true }}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          borderRadius: height / 2,
          backgroundColor: inactive && bg !== 'transparent' ? `${colors.text}1F` : bg,
          borderColor: inactive && border ? `${colors.text}1F` : border,
          borderWidth: border ? 1 : 0,
          opacity: pressed ? 0.85 : 1,
        },
        size === 'small' && styles.small,
        variant === 'text' && styles.textOnly,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={[styles.row, inactive && styles.faded]}>
          {typeof icon === 'string' ? <Icon name={icon as IconName} size={18} color={content} /> : icon}
          <Text style={[typeStyles.button, size === 'small' && styles.smallText, { color: content }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, overflow: 'hidden' },
  small: { paddingHorizontal: 16 },
  textOnly: { paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  faded: { opacity: 0.38 },
  smallText: { fontSize: 14 },
});
