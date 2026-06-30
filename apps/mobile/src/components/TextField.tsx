import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { colors, radius } from '../design/tokens';

export function TextField({ label, ...props }: { label?: string } & TextInputProps) {
  return (
    <View style={styles.wrap}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput placeholderTextColor={colors.sub} style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  label: { fontSize: 13, color: colors.sub, fontWeight: '700' },
  input: {
    backgroundColor: '#FBF7F0',
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.button,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.ink,
  },
});
