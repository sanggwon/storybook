import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { CharacterRecord } from '@storybook/shared';
import { Stepper } from '../../src/components/Stepper';
import { api } from '../../src/api/client';
import { colors, radius, typography } from '../../src/design/tokens';

function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 360, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(d, { toValue: 0, duration: 360, useNativeDriver: Platform.OS !== 'web' }),
          Animated.delay((2 - i) * 160),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);
  return (
    <View style={styles.typing}>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={[styles.typingDot, { opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }), transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }]}
        />
      ))}
    </View>
  );
}

const STARTERS = ['집안 대모험', '잠자리 우주여행', '욕실 바다탐험', '마당 정글탐험', '요리 동화', '직접 입력'];

type Msg = { role: 'user' | 'assistant'; content: string };

function extractPlan(text: string): any | null {
  const m = text.match(/```json\s*([\s\S]*?)```/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return null;
  }
}
function parseOptions(text: string): { clean: string; options: string[] } {
  // ::OPTIONS:: / OPTIONS: / **OPTIONS::** 등 형식 변형과 줄바꿈/마크다운을 모두 허용
  const m = text.match(/:{0,2}\s*OPTIONS\s*:{1,2}\s*([\s\S]*)$/i);
  if (!m || m.index === undefined) return { clean: text.trim(), options: [] };
  const options = Array.from(
    new Set(
      m[1]
        .split(/\|\||\n/)
        .map((s) => s.replace(/^[\s*\-\u2022\d.)]+/, '').replace(/\*+/g, '').trim())
        .filter(Boolean)
    )
  );
  const clean = text.slice(0, m.index).replace(/[*\s]+$/, '').trim();
  return { clean, options };
}

export default function Concept() {
  const router = useRouter();
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const idList = (ids ?? '').split(',').filter(Boolean);

  const [chars, setChars] = useState<CharacterRecord[]>([]);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: '안녕하세요! 등장 캐릭터로 어떤 동화를 만들어 볼까요? 아래에서 고르거나 직접 적어 주세요.' },
  ]);
  const [options, setOptions] = useState<string[]>(STARTERS);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      try {
        const all = await api.listCharacters();
        setChars(all.filter((c) => idList.includes(c.id)));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages, options]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || loading) return;
    setInput('');
    setOptions([]);
    const next: Msg[] = [...messages, { role: 'user', content: t }];
    setMessages(next);
    setLoading(true);
    try {
      const { reply } = await api.planChat(next, idList);
      const plan = extractPlan(reply);
      if (plan) {
        const clean = reply.replace(/```json[\s\S]*?```/i, '').replace('✅ 구성 확정', '').trim() || '✅ 구성이 확정됐어요! 스토리보드를 만들어 볼게요.';
        setMessages([...next, { role: 'assistant', content: clean }]);
        await confirmPlan(plan);
      } else {
        const { clean, options: opts } = parseOptions(reply);
        setMessages([...next, { role: 'assistant', content: clean }]);
        setOptions(opts);
      }
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmPlan(plan: any) {
    try {
      const state = {
        ...plan,
        characters: chars.map((c) => ({ id: c.id, name: c.name, role: c.role, sheetUrl: c.sheetUrl, lockedDesc: c.lockedDesc })),
      };
      const { storyId } = await api.createStory(plan.topic || '우리 아이 동화', state);
      router.replace({ pathname: '/create/storyboard', params: { id: storyId } });
    } catch (e: any) {
      Alert.alert('오류', e.message);
    }
  }

  function tapOption(o: string) {
    if (o === '직접 입력') {
      setOptions([]);
      return;
    }
    send(o);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
          <Stepper current={2} />
          {messages.map((m, i) => (
            <View key={i} style={[styles.bubble, m.role === 'user' ? styles.user : styles.ai]}>
              {m.role === 'assistant' && <Text style={styles.sender}>✦ 도란도란</Text>}
              <Text style={[styles.bubbleTxt, m.role === 'user' && { color: '#fff' }]}>{m.content}</Text>
            </View>
          ))}
          {loading && <TypingDots />}
          {options.length > 0 && (
            <View style={styles.opts}>
              {options.map((o, i) => (
                <Pressable key={`${i}-${o}`} style={styles.opt} onPress={() => tapOption(o)}>
                  <Text style={styles.optTxt}>{o}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="직접 입력해도 좋아요"
            placeholderTextColor={colors.sub}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
          />
          <Pressable style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]} onPress={() => send(input)} disabled={!input.trim() || loading}>
            <Text style={styles.sendTxt}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  bubble: { maxWidth: '86%', paddingVertical: 11, paddingHorizontal: 15, borderRadius: 18 },
  ai: { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6 },
  user: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  sender: { fontSize: 11, fontWeight: '700', color: colors.accentDeep, marginBottom: 3 },
  bubbleTxt: { fontSize: typography.body, color: colors.ink, lineHeight: 22 },
  typing: { alignSelf: 'flex-start', flexDirection: 'row', gap: 5, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 18, borderBottomLeftRadius: 6, paddingVertical: 14, paddingHorizontal: 16 },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#CDBFA9' },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  opt: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.accent, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 14 },
  optTxt: { color: colors.accentDeep, fontSize: 13, fontWeight: '600' },
  composer: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card },
  input: { flex: 1, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.button, paddingHorizontal: 16, paddingVertical: 11, fontSize: typography.body, color: colors.ink },
  sendBtn: { width: 46, height: 46, backgroundColor: colors.accent, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  sendTxt: { color: '#fff', fontWeight: '700', fontSize: 20 },
});
