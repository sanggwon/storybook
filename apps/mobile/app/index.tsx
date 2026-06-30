import { Redirect } from 'expo-router';

// 진입점: 인증 게이트(_layout)가 미로그인 시 로그인으로 보낸다.
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
