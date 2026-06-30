import { Stack } from 'expo-router';
import { colors } from '../../src/design/tokens';

export default function CreateLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="characters" options={{ title: '캐릭터 만들기' }} />
      <Stack.Screen name="concept" options={{ title: '이야기 만들기' }} />
      <Stack.Screen name="storyboard" options={{ title: '스토리보드 미리보기' }} />
      <Stack.Screen name="book" options={{ title: '동화책' }} />
    </Stack>
  );
}
