import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { fonts, type as typeStyles, useColors } from '@/lib/theme';

type Props = TextInputProps & { label: string; hint?: string };

export function TextField({ label, hint, style, ...input }: Props) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <Text style={[typeStyles.label, { color: colors.muted }]}>{label.toUpperCase()}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        {...input}
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
          style,
        ]}
      />
      {hint && <Text style={[typeStyles.caption, { color: colors.muted, lineHeight: 19 }]}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  input: {
    height: 54,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    fontSize: 17,
    fontFamily: fonts.semibold,
  },
});
