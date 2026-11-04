import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { Glass } from '@/components/glass';

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  children: ReactNode;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** A round frosted button floating over the map (back, settings, map controls). */
export function GlassButton({ onPress, accessibilityLabel, children, size = 48, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, style]}>
      <Glass
        radius={size / 2}
        floating
        style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </Glass>
    </Pressable>
  );
}
