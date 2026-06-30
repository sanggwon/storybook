import { Text, View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/store/auth';
import { colors, typography, radius, shadows } from '../../src/design/tokens';

function Tile({
  emoji,
  bg,
  title,
  sub,
  onPress,
}: {
  emoji: string;
  bg: string;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, shadows.soft, pressed && styles.tilePressed]}>
      <View style={[styles.tileIcon, { backgroundColor: bg }]}>
        <Text style={styles.tileEmoji}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSub}>{sub}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

export default function Home() {
  const user = useAuth((s) => s.user);
  const router = useRouter();
  const name = user?.name || '우리 아이';

  return (
    <Screen scroll>
      <Text style={styles.hi}>
        안녕하세요, <Text style={styles.hiName}>{name}</Text> 부모님 👋
      </Text>
      <Text style={styles.title}>오늘은 어떤 이야기를 만들까요?</Text>

      {/* 히어로 카드 */}
      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <Text style={{ fontSize: 30 }}>📖</Text>
        </View>
        <Text style={styles.heroTitle}>
          <Text style={styles.heroAccent}>우리 아이</Text>가{'\n'}주인공이 되는 동화책
        </Text>
        <Text style={styles.heroSub}>사진 한 장과 짧은 대화면 충분해요</Text>
      </View>

      <Text style={styles.label}>시작하기</Text>
      <View style={{ gap: 12 }}>
        <Tile
          emoji="✨"
          bg="#F6E6DA"
          title="새 동화 만들기"
          sub="캐릭터부터 한 권까지, 네 단계면 끝"
          onPress={() => router.push('/create/characters')}
        />
        <Tile
          emoji="📚"
          bg="#E6E9D6"
          title="내 책장"
          sub="지금까지 만든 동화를 다시 펼쳐봐요"
          onPress={() => router.push('/(tabs)/library')}
        />
        <Tile
          emoji="🎁"
          bg="#FBEEDB"
          title="선물하기"
          sub="완성한 동화를 가족에게 보내요"
          onPress={() => router.push('/(tabs)/library')}
        />
      </View>

      <Button
        label="새 동화 만들기 시작 →"
        onPress={() => router.push('/create/characters')}
        style={{ marginTop: 24 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hi: { fontSize: typography.body, color: colors.sub, marginTop: 6 },
  hiName: { color: colors.ink, fontWeight: '700' },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 4,
    letterSpacing: typography.headTracking,
    lineHeight: 34,
  },
  hero: {
    marginTop: 20,
    backgroundColor: '#F3DEC9',
    borderRadius: 26,
    padding: 24,
    overflow: 'hidden',
    ...shadows.soft,
  },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
    lineHeight: 32,
    letterSpacing: typography.headTracking,
  },
  heroAccent: { color: colors.accentDeep },
  heroSub: { marginTop: 8, fontSize: 14, color: colors.ink, opacity: 0.7 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.sub,
    textTransform: 'uppercase',
    marginTop: 26,
    marginBottom: 12,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 16,
  },
  tilePressed: { transform: [{ scale: 0.99 }], backgroundColor: '#FCFAF5' },
  tileIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileEmoji: { fontSize: 22 },
  tileTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  tileSub: { fontSize: 12.5, color: colors.sub, marginTop: 2 },
  arrow: { fontSize: 24, color: colors.sub, marginLeft: 4 },
});
