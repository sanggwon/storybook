import { ReactNode } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../design/tokens';

export function Screen({
  children,
  scroll,
  center,
}: {
  children: ReactNode;
  scroll?: boolean;
  center?: boolean;
}) {
  const body = <View style={[styles.body, center && styles.center]}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: spacing.screen },
  center: { justifyContent: 'center' },
  scroll: { padding: spacing.screen, flexGrow: 1 },
});
