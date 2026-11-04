import { BlurView } from 'expo-blur';
import { createContext, useContext, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { StyleSheet, useColorScheme, View, type StyleProp, type ViewStyle } from 'react-native';

import { floatShadow, useColors } from '@/lib/theme';

/**
 * On Android, a BlurView only blurs the content of a BlurTargetView it points at. Screens
 * that float glass over the map wrap the map in one and provide its ref here.
 */
export const GlassTarget = createContext<RefObject<ComponentRef<typeof View> | null> | null>(null);

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Corner radius; the blur is clipped to it. */
  radius?: number;
  /** Adds the floating drop shadow (top bars, buttons); sheets draw their own. */
  floating?: boolean;
};

/** A frosted-glass panel: blurred map behind a translucent tint and a hairline edge. */
export function Glass({ children, style, radius = 0, floating = false }: Props) {
  const colors = useColors();
  const dark = useColorScheme() === 'dark';
  const target = useContext(GlassTarget);

  return (
    <View
      style={[
        { borderRadius: radius, borderWidth: 1, borderColor: colors.glassBorder },
        floating && floatShadow(colors),
        style,
      ]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]} pointerEvents="none">
        {target && (
          <BlurView
            blurTarget={target}
            blurMethod="dimezisBlurViewSdk31Plus"
            intensity={60}
            tint={dark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}
        {/* The tint carries the look on its own where blur isn't available. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glass }]} />
      </View>
      {children}
    </View>
  );
}
