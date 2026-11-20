import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { floatShadow, useColors } from '@/lib/theme';

/** A raised panel over the map (the top bar, map buttons): a solid tonal surface with a shadow. */
export function Floating({
  children,
  style,
  radius,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius: number;
}) {
  const colors = useColors();
  return (
    <View style={[{ borderRadius: radius, backgroundColor: colors.glass }, floatShadow(colors), style]}>
      {children}
    </View>
  );
}

type MapButtonProps = {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  /** The primary floating action button (larger, primary container colour). */
  primary?: boolean;
  /** A round button (back) rather than a rounded square. */
  round?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Material's small floating action button, for map controls; `primary` is the regular FAB. */
export function MapButton({
  icon,
  onPress,
  accessibilityLabel,
  primary,
  round,
  style,
  children,
}: MapButtonProps & { children?: ReactNode }) {
  const colors = useColors();
  const size = primary ? 56 : 48;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: round ? size / 2 : 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primary ? colors.accentFill : colors.glass,
          opacity: pressed ? 0.8 : 1,
        },
        floatShadow(colors),
        style,
      ]}>
      {children ?? (
        <Icon
          name={icon}
          size={24}
          filled={primary}
          color={primary ? colors.onAccentFill : round ? colors.text : colors.muted}
        />
      )}
    </Pressable>
  );
}

/**
 * The compass: an arrow that always points to real north. `bearing` is the map's rotation, so
 * the arrow turns the other way. Grey while the map faces north and lies flat, red once it's
 * turned or tilted, as a hint that tapping puts it back.
 */
export function CompassNeedle({ bearing, northUp }: { bearing: number; northUp: boolean }) {
  const colors = useColors();
  return (
    <Icon
      name="navigation"
      size={24}
      filled
      color={northUp ? colors.muted : colors.danger}
      style={{ transform: [{ rotate: `${-bearing}deg` }] }}
    />
  );
}

/** A plain icon button (close, options, back in a header). */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  filled,
  color,
  disabled,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  /** A tonal circle behind the icon. */
  filled?: boolean;
  color?: string;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.38 : pressed ? 0.6 : 1,
      })}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled ? colors.surfaceHighest : 'transparent',
        }}>
        <Icon name={icon} size={filled ? 20 : 24} color={color ?? colors.muted} />
      </View>
    </Pressable>
  );
}
