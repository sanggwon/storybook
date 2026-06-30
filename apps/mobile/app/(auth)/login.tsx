import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { useAuth } from '../../src/store/auth';
import { colors, typography } from '../../src/design/tokens';

export default function Login() {
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setLoading(true);
    setErr('');
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setErr(e.message === 'invalid_credentials' ? '이메일 또는 비밀번호가 올바르지 않아요.' : e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen center>
      <View style={styles.brand}>
        <View style={styles.logo}><Text style={{ fontSize: 32 }}>📖</Text></View>
        <Text style={styles.wordmark}>도란도란</Text>
      </View>
      <Text style={styles.title}>다시 만나서 반가워요</Text>
      <Text style={styles.sub}>우리 아이가 주인공인 동화책으로 돌아오신 걸 환영해요</Text>
      <View style={styles.form}>
        <TextField
          label="이메일"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
        />
        <TextField label="비밀번호" secureTextEntry value={password} onChangeText={setPassword} placeholder="6자 이상" />
        {!!err && <View style={styles.errBox}><Text style={styles.err}>{err}</Text></View>}
        <Button label="로그인" onPress={submit} loading={loading} />
        <Link href="/(auth)/register" style={styles.link}>
          계정이 없으신가요? 회원가입
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: 10, marginBottom: 22 },
  logo: { width: 68, height: 68, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontSize: 22, fontWeight: '700', color: colors.ink, letterSpacing: typography.headTracking },
  title: { fontSize: typography.title, fontWeight: '700', color: colors.ink, textAlign: 'center', letterSpacing: typography.headTracking },
  sub: { fontSize: typography.body, color: colors.sub, marginTop: 8, marginBottom: 26, textAlign: 'center', lineHeight: 22 },
  form: { gap: 14 },
  errBox: { backgroundColor: '#F7E3DF', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  err: { color: '#B23B2E', fontSize: 13, fontWeight: '600' },
  link: { textAlign: 'center', color: colors.accentDeep, fontSize: 14, fontWeight: '600', marginTop: 8 },
});
