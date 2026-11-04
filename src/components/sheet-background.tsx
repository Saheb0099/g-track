import { useBottomSheetInternal, type BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { Glass } from '@/components/glass';
import { radius } from '@/lib/theme';

/**
 * The frosted sheet panel. The sheet is always as tall as fully open and slides down out of
 * view, which would hide its bottom corners; sizing the panel to just the visible part keeps
 * it a rounded card floating above the navigation bar at every height.
 */
export function SheetBackground({ animatedPosition, pointerEvents }: BottomSheetBackgroundProps) {
  const { animatedLayoutState } = useBottomSheetInternal();
  const visible = useAnimatedStyle(() => ({
    height: Math.max(0, animatedLayoutState.get().containerHeight - animatedPosition.get()),
  }));

  return (
    <Animated.View pointerEvents={pointerEvents} style={[styles.panel, visible]}>
      <Glass radius={radius.sheet} style={styles.fill} />
    </Animated.View>
  );
}

/**
 * The space a sheet moves in: it stops above Android's navigation bar so nothing on the sheet
 * sits behind the bar's buttons, and clips the sheet's contents to the card's rounded bottom.
 */
export function SheetArea({ bottom, children }: { bottom: number; children: ReactNode }) {
  return (
    <View style={[styles.area, { bottom }]} pointerEvents="box-none">
      {children}
    </View>
  );
}

const styles = {
  area: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    borderBottomLeftRadius: radius.sheet,
    borderBottomRightRadius: radius.sheet,
    overflow: 'hidden',
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderRadius: radius.sheet,
    shadowColor: '#0E1116',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  fill: { flex: 1 },
} as const;
