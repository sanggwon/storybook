import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../design/tokens';

const STEPS = ['캐릭터', '이야기', '스토리보드', '동화책'];

// 동화 만들기 4단계 진행 표시기. current: 1~4
export function Stepper({ current }: { current: number }) {
  return (
    <View style={styles.wrap}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <View key={label} style={styles.item}>
            <View style={styles.row}>
              {i > 0 && <View style={[styles.line, n <= current && styles.lineOn]} />}
              <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                <Text style={[styles.num, done && styles.numDone, active && styles.numOn]}>{done ? '✓' : n}</Text>
              </View>
              {i < STEPS.length - 1 && <View style={[styles.line, n < current && styles.lineOn]} />}
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const SIZE = 28;
const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', marginBottom: 18, marginTop: 2 },
  item: { flex: 1, alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  line: { flex: 1, height: 2, backgroundColor: colors.line },
  lineOn: { backgroundColor: colors.accent },
  dot: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  dotActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  num: { fontSize: 12, fontWeight: '700', color: colors.sub },
  numOn: { color: '#fff' },
  numDone: { color: colors.accentDeep },
  label: { fontSize: 11, color: colors.sub, fontWeight: '600' },
  labelActive: { color: colors.accentDeep, fontWeight: '700' },
});
