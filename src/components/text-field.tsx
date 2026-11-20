import { useState } from 'react';
import { StyleSheet, View, type TextInputProps } from 'react-native';

import { Text, TextInput } from '@/components/text';
import { fonts, radius, type as typeStyles, useColors } from '@/lib/theme';

type Props = TextInputProps & { label: string; hint?: string };

/** Material 3's outlined text field, its label sitting in the outline. */
export function TextField({ label, hint, style, onFocus, onBlur, ...input }: Props) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const edge = focused ? colors.accent : colors.outline;
  return (
    <View style={styles.container}>
      <View>
        <TextInput
          placeholderTextColor={colors.muted}
          cursorColor={colors.accent}
          selectionColor={`${colors.accent}55`}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: edge,
              borderWidth: focused ? 2 : 1,
              paddingHorizontal: focused ? 15 : 16,
            },
            style,
          ]}
        />
        <Text
          style={[styles.label, { color: focused ? colors.accent : colors.muted, backgroundColor: colors.background }]}
          pointerEvents="none">
          {label}
        </Text>
      </View>
      {hint && (
        <Text style={[typeStyles.caption, styles.hint, { color: colors.muted, fontSize: 12, lineHeight: 16 }]}>
          {hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4, paddingTop: 8 },
  input: { height: 56, borderRadius: radius.field, fontSize: 16, fontFamily: fonts.regular },
  label: { position: 'absolute', left: 12, top: -9, paddingHorizontal: 4, fontSize: 12, lineHeight: 16 },
  hint: { paddingHorizontal: 16 },
});
