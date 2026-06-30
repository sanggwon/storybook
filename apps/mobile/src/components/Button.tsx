import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, shadows } from '../design/tokens';

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
  style?: ViewStyle;
}) {
  const ghost = variant === 'ghost';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        ghost ? styles.ghost : [styles.primary, shadows.accent],
        pressed && !ghost && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={ghost ? colors.accent : '#fff'} />
      ) : (
        <Text style={[styles.label, ghost && styles.ghostLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: 16, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.accent },
  pressed: { backgroundColor: colors.accentDeep, transform: [{ scale: 0.985 }] },
  ghost: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line },
  disabled: { opacity: 0.45 },
  label: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ghostLabel: { color: colors.ink },
});
