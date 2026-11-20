import { forwardRef, type ComponentRef } from 'react';
// The one place allowed to use React Native's own Text and TextInput (see eslint.config.js).
// eslint-disable-next-line no-restricted-imports
import { Text as NativeText, TextInput as NativeTextInput, type TextInputProps, type TextProps } from 'react-native';

/**
 * Text drawn at the design's sizes, whatever text size the phone is set to: the layout (the
 * map's sheet, tiles, buttons) is sized for these exact sizes.
 */
export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps>(function Text(props, ref) {
  return <NativeText ref={ref} allowFontScaling={false} {...props} />;
});

export const TextInput = forwardRef<ComponentRef<typeof NativeTextInput>, TextInputProps>(
  function TextInput(props, ref) {
    return <NativeTextInput ref={ref} allowFontScaling={false} {...props} />;
  },
);
