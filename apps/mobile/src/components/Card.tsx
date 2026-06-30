import { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, shadows } from '../design/tokens';

export function Card({
  children,
  style,
  flat,
}: {
  children: ReactNode;
  style?: ViewStyle;
  flat?: boolean;
}) {
  return <View style={[styles.card, !flat && shadows.soft, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
  },
});
