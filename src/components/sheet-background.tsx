import type { BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { radius, useColors } from '@/lib/theme';

/** Material's standard bottom sheet: edge to edge, rounded top corners, a soft shadow above. */
export function SheetBackground({ style, pointerEvents }: BottomSheetBackgroundProps) {
  const colors = useColors();
  return (
    <View
      pointerEvents={pointerEvents}
      style={[
        style,
        {
          backgroundColor: colors.background,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          shadowColor: colors.shadow,
          shadowOpacity: 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -1 },
          elevation: 8,
        },
      ]}
    />
  );
}

/** Where cards sit on a sheet (its side padding) and how round their corners are. */
const CARD_INSET = 16;
const CORNER = radius.card;

/**
 * Covers the square corners a card gets where the sheet's visible area cuts it off: a square of
 * the sheet's colour with a quarter circle cut out, so the cut-off card still ends rounded.
 */
function CornerCap({ side, color }: { side: 'left' | 'right'; color: string }) {
  return (
    <View pointerEvents="none" style={[styles.cap, side === 'left' ? { left: CARD_INSET } : { right: CARD_INSET }]}>
      <View
        style={[styles.capRing, { borderColor: color }, side === 'left' ? { left: -CORNER } : { right: -CORNER }]}
      />
    </View>
  );
}

/**
 * The space a sheet moves in. It stops at Android's navigation bar and clips the sheet there,
 * so nothing on the sheet sits behind the bar's buttons; the bar's strip is painted in the
 * sheet's colour, so the sheet still looks edge to edge. A card cut off at that edge keeps
 * rounded corners.
 */
export function SheetArea({ bottom, children }: { bottom: number; children: ReactNode }) {
  const colors = useColors();
  return (
    <>
      <View style={[styles.navBar, { height: bottom, backgroundColor: colors.background }]} pointerEvents="none" />
      <View style={[styles.area, { bottom }]} pointerEvents="box-none">
        {children}
        <CornerCap side="left" color={colors.background} />
        <CornerCap side="right" color={colors.background} />
      </View>
    </>
  );
}

const styles = {
  area: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  navBar: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  cap: { position: 'absolute', bottom: 0, width: CORNER, height: CORNER, overflow: 'hidden' },
  // A ring whose clear middle is the card's corner circle; only its outside shows in the cap.
  capRing: {
    position: 'absolute',
    top: -CORNER * 2,
    width: CORNER * 4,
    height: CORNER * 4,
    borderRadius: CORNER * 2,
    borderWidth: CORNER,
  },
} as const;
