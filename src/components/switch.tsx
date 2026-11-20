import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { useColors } from '@/lib/theme';

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

/** Material 3's switch: a wide track, a thumb that grows and shows a check when on. */
export function Switch({ value, onValueChange, accessibilityLabel, disabled }: Props) {
  const colors = useColors();
  const on = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    on.set(withTiming(value ? 1 : 0, { duration: 150 }));
  }, [on, value]);

  // Positions inside the 2 pt border: a 16 pt thumb when off, 24 pt when on.
  const thumb = useAnimatedStyle(() => {
    const size = interpolate(on.get(), [0, 1], [16, 24]);
    return {
      width: size,
      height: size,
      left: interpolate(on.get(), [0, 1], [6, 22]),
      top: interpolate(on.get(), [0, 1], [6, 2]),
    };
  });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={8}
      style={[
        styles.track,
        {
          backgroundColor: value ? colors.accent : colors.fill,
          borderColor: value ? colors.accent : colors.outline,
          opacity: disabled ? 0.38 : 1,
        },
      ]}>
      <Animated.View style={[styles.thumb, { backgroundColor: value ? colors.onAccent : colors.outline }, thumb]}>
        {value && <Icon name="check" size={16} color={colors.accent} />}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 52, height: 32, borderRadius: 16, borderWidth: 2 },
  thumb: { position: 'absolute', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
