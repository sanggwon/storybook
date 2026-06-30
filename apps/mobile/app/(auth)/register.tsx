import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { useAuth } from '../../src/store/auth';
import { colors, typography } from '../../src/design/tokens';

export default function Register() {
  const register = useAuth((s) => s.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setLoading(true);
    setErr('');
    try {
      await register(email.trim(), password, name.trim() || undefined);
    } catch (e: any) {
      setErr(e.message === 'email_taken' ? '이미 가입된 이메일이에요.' : e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen center scroll>
      <View style={styles.brand}>
        <View style={styles.logo}><Text style={{ fontSize: 32 }}>📖</Text></View>
        <Text style={styles.wordmark}>도란도란</Text>
      </View>
      <Text style={styles.title}>아이를 위한 첫 동화</Text>
      <Text style={styles.sub}>사진 한 장과 짧은 대화면, 세상에 하나뿐인 동화책이 시작돼요</Text>
      <View style={styles.form}>
        <TextField label="이름 (선택)" value={name} onChangeText={setName} placeholder="부모님 이름" />
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
        <Button label="회원가입" onPress={submit} loading={loading} />
        <Link href="/(auth)/login" style={styles.link}>
          이미 계정이 있으신가요? 로그인
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
