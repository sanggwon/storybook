import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/store/auth';
import { api } from '../../src/api/client';
import { colors, typography, radius, shadows } from '../../src/design/tokens';

export default function Settings() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [health, setHealth] = useState('');

  async function check() {
    try {
      const r = await api.health();
      setHealth(`✅ ${r.service} · ${r.status}`);
    } catch (e: any) {
      setHealth(`⚠️ ${e.message}`);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>설정</Text>

      <View style={styles.creditCard}>
        <Text style={styles.creditLabel}>보유 크레딧</Text>
        <Text style={styles.creditAmt}>{user?.credits ?? 0} <Text style={styles.creditUnit}>크론</Text></Text>
        <Text style={styles.creditHint}>동화책 한 권을 만들 때 사용돼요</Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.label}>계정</Text>
        <Text style={styles.value}>{user?.email ?? '-'}</Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.label}>서버 상태</Text>
        <Button label="API 연결 확인" variant="ghost" onPress={check} />
        {!!health && <Text style={styles.value}>{health}</Text>}
      </Card>

      <View style={{ flex: 1 }} />
      <Button label="로그아웃" variant="ghost" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.title, fontWeight: '700', color: colors.ink, marginTop: 8, letterSpacing: typography.headTracking },
  creditCard: { marginTop: 16, backgroundColor: '#F3DEC9', borderRadius: radius.card, padding: 22, ...shadows.soft },
  creditLabel: { fontSize: 12, fontWeight: '700', color: colors.accentDeep, letterSpacing: 0.5, textTransform: 'uppercase' },
  creditAmt: { fontSize: 34, fontWeight: '700', color: colors.ink, marginTop: 6, letterSpacing: typography.headTracking },
  creditUnit: { fontSize: 16, fontWeight: '600', color: colors.sub },
  creditHint: { fontSize: 13, color: colors.ink, opacity: 0.7, marginTop: 4 },
  card: { marginTop: 14, gap: 8 },
  label: { fontSize: typography.caption, color: colors.sub, fontWeight: '700' },
  value: { fontSize: typography.body, color: colors.ink },
});
