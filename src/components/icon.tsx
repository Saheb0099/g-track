import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { Text } from '@/components/text';

/**
 * Material Symbols, drawn from the font loaded in the root layout
 * (@expo-google-fonts/material-symbols). Only the icons the app uses are listed; add a name
 * with its code point from https://fonts.google.com/icons.
 */
const GLYPHS = {
  add: 0xe145,
  arrow_back: 0xe5c4,
  arrow_drop_down: 0xe5c5,
  battery_1_bar: 0xebd9,
  battery_2_bar: 0xebe0,
  battery_3_bar: 0xebdd,
  battery_4_bar: 0xebe2,
  battery_5_bar: 0xebd4,
  battery_6_bar: 0xebd2,
  battery_full: 0xe1a4,
  check: 0xe5ca,
  check_circle: 0xe86c,
  chevron_right: 0xe5cc,
  close: 0xe5cd,
  commute: 0xe940,
  contrast: 0xeb37,
  delete: 0xe872,
  directions: 0xe52e,
  error: 0xe000,
  groups: 0xf233,
  info: 0xe88e,
  key: 0xe73c,
  layers: 0xe53b,
  location_off: 0xe0c7,
  location_on: 0xe0c8,
  logout: 0xe9ba,
  map: 0xe55b,
  more_vert: 0xe5d4,
  my_location: 0xe55c,
  navigation: 0xe55d,
  near_me: 0xe569,
  open_in_new: 0xe89e,
  pause_circle: 0xe1a2,
  radio_button_unchecked: 0xe836,
  refresh: 0xe5d5,
  remove: 0xe15b,
  route: 0xeacd,
  schedule: 0xe8b5,
  settings: 0xe8b8,
  share: 0xe80d,
  share_location: 0xf05f,
  timer: 0xe425,
  verified_user: 0xe8e8,
  visibility_off: 0xe8f5,
} as const;

export type IconName = keyof typeof GLYPHS;

/** Font names registered in the root layout. */
export const ICON_FONTS = { outlined: 'MaterialSymbols_400Regular', filled: 'MaterialSymbols_400Regular_Filled' };

type Props = {
  name: IconName;
  size?: number;
  color: string;
  /** The filled version (selected states, status icons). */
  filled?: boolean;
  style?: StyleProp<TextStyle>;
};

export function Icon({ name, size = 24, color, filled = false, style }: Props) {
  return (
    <Text
      accessible={false}
      importantForAccessibility="no"
      allowFontScaling={false}
      style={[
        styles.icon,
        {
          fontFamily: filled ? ICON_FONTS.filled : ICON_FONTS.outlined,
          fontSize: size,
          lineHeight: size,
          width: size,
          height: size,
          color,
        },
        style,
      ]}>
      {String.fromCharCode(GLYPHS[name])}
    </Text>
  );
}

/** A battery icon for a percentage. */
export function batteryIcon(percent: number): IconName {
  if (percent >= 95) return 'battery_full';
  const bars = ['battery_1_bar', 'battery_2_bar', 'battery_3_bar', 'battery_4_bar', 'battery_5_bar', 'battery_6_bar'];
  return bars[Math.min(5, Math.floor(percent / 16))] as IconName;
}

const styles = StyleSheet.create({
  icon: { textAlign: 'center', includeFontPadding: false, textAlignVertical: 'center' },
});
