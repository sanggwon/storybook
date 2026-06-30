import 'react-native-gesture-handler';
import { ReactNode, useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '../src/store/auth';
import { colors } from '../src/design/tokens';

const queryClient = new QueryClient();

function AuthGate({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.token);
  const ready = useAuth((s) => s.ready);
  const bootstrap = useAuth((s) => s.bootstrap);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    if (!token && !inAuth) router.replace('/(auth)/login');
    else if (token && inAuth) router.replace('/(tabs)');
  }, [ready, token, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      </AuthGate>
    </QueryClientProvider>
  );
}
