import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { StoryRecord } from '@storybook/shared';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Stepper } from '../../src/components/Stepper';
import { BookViewer } from '../../src/components/BookViewer';
import { api } from '../../src/api/client';
import { colors, radius, typography, spacing } from '../../src/design/tokens';

export default function Book() {
  const router = useRouter();
  const { id, gen } = useLocalSearchParams<{ id: string; gen?: string }>();
  const [story, setStory] = useState<StoryRecord | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const started = useRef(false);

  async function generate() {
    setGenerating(true);
    try {
      const { jobId } = await api.startBook(id);
      let done = false;
      let fails = 0;
      while (!done) {
        await new Promise((r) => setTimeout(r, 2000));
        let job;
        try {
          job = await api.getJob(jobId);
          fails = 0;
        } catch (err) {
          fails++;
          if (fails > 15) throw err;
          continue; // 일시적 네트워크/ngrok 끊김 → 계속 폴링
        }
        setProgress(job.progress ?? 0);
        try {
          setStory(await api.getStory(id)); // 완료되는 페이지부터 점진 표시
        } catch {
          /* ignore */
        }
        if (job.status === 'done') done = true;
        else if (job.status === 'failed') {
          done = true;
          Alert.alert('생성 실패', job.error ?? '다시 시도해 주세요.');
        }
      }
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (started.current || !id) return;
    started.current = true;
    (async () => {
      try {
        const s = await api.getStory(id);
        setStory(s);
        // 생성 플로우에서 온 경우(gen=1)에만 자동 생성. 책장에서 열면 보기만.
        if (s.status !== 'done' && gen === '1') generate();
      } catch (e: any) {
        Alert.alert('오류', e.message);
      }
    })();
  }, [id]);

  const total = story?.scenes.length ?? 0;
  const doneCount = story?.scenes.filter((s) => s.imageUrl).length ?? 0;

  // 완성된 동화책은 반응형 뷰어(태블릿=책장 넘김 / 폰=웹툰)로 표시
  if (story && !generating && story.status === 'done') {
    return <BookViewer story={story} />;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.screen }}>
      <Stepper current={4} />
      {generating && (
        <Card style={{ gap: 10, marginBottom: 12 }}>
          <Text style={styles.label}>
            동화책을 그리는 중… ({doneCount}/{total})
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(5, progress)}%` }]} />
          </View>
          <Text style={styles.sub}>완성되는 페이지부터 아래에 나타나요. 앱을 닫아도 계속 만들어집니다.</Text>
        </Card>
      )}

      {!!story && <Text style={styles.title}>{story.title}</Text>}

      {(story?.scenes ?? []).map((s) => (
        <Card key={s.id} style={styles.page}>
          {s.imageUrl ? (
            <Image source={{ uri: s.imageUrl }} style={styles.img} resizeMode="cover" />
          ) : (
            <View style={[styles.img, styles.ph]}>
              <Text style={styles.sub}>그리는 중…</Text>
            </View>
          )}
          <Text style={styles.pageNo}>
            {s.no}. {s.title}
          </Text>
          {!!s.text && <Text style={styles.pageText}>{s.text}</Text>}
        </Card>
      ))}

      {!generating && story && story.status !== 'done' && (
        <Button
          label={story.scenes.some((s) => s.imageUrl) ? '이어서 동화책 만들기' : '동화책 만들기'}
          onPress={generate}
          style={{ marginTop: 12 }}
        />
      )}

      {!generating && story?.status === 'done' && (
        <View style={styles.doneCard}>
          <Text style={{ fontSize: 36 }}>🎉</Text>
          <Text style={styles.doneTitle}>동화책이 완성됐어요!</Text>
          <Text style={styles.sub}>내 책장에 저장됐어요. 언제든 다시 펼쳐볼 수 있어요.</Text>
          <Button label="홈으로" onPress={() => router.replace('/(tabs)')} style={{ marginTop: 14, alignSelf: 'stretch' }} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.title, fontWeight: '700', color: colors.ink, marginBottom: 12, letterSpacing: typography.headTracking },
  label: { fontSize: 13, color: colors.sub, fontWeight: '700' },
  sub: { fontSize: typography.caption, color: colors.sub, lineHeight: 19, textAlign: 'center' },
  track: { height: 8, backgroundColor: colors.accentSoft, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.accent, borderRadius: 4 },
  page: { marginBottom: 14, gap: 10, padding: 14 },
  img: { width: '100%', aspectRatio: 1.5, borderRadius: radius.card, backgroundColor: '#000' },
  ph: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
  pageNo: { fontSize: 13, fontWeight: '700', color: colors.accentDeep },
  pageText: { fontSize: 15.5, color: colors.ink, lineHeight: 26 },
  doneCard: { alignItems: 'center', gap: 6, marginTop: 16, backgroundColor: colors.accentSoft, borderRadius: radius.card, padding: 28 },
  doneTitle: { fontSize: typography.subtitle, fontWeight: '700', color: colors.ink, letterSpacing: typography.headTracking },
});
