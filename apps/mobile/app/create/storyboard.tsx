import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Alert, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { StoryRecord } from '@storybook/shared';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Stepper } from '../../src/components/Stepper';
import { api, imageSource } from '../../src/api/client';
import { colors, radius, typography, spacing, shadows } from '../../src/design/tokens';

const MESSAGES = ['이야기 글을 쓰는 중…', '연출 스펙을 정리하는 중…', '의상 레퍼런스를 그리는 중…', '장면을 배치하는 중…', '거의 다 됐어요…'];

type WardrobeItem = { name?: string; outfit?: string; outfitKo?: string; refUrl?: string };
type CastMember = { name?: string; descKo?: string; outfitKo?: string; sheetUrl?: string };
type Bible = {
  setting?: string;
  settingKo?: string;
  castMembers?: CastMember[];
  wardrobe?: WardrobeItem[];
  extras?: string;
  extrasKo?: string;
  scenes?: { no: number; cast?: string[]; directionKo?: string; props?: string[]; propsKo?: string[]; outfitOverride?: { name?: string; outfit?: string; outfitKo?: string }[]; extras?: string }[];
};

export default function Storyboard() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [story, setStory] = useState<StoryRecord | null>(null);
  const [progress, setProgress] = useState(5);
  const [msg, setMsg] = useState(MESSAGES[0]);
  const [failed, setFailed] = useState(false);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [editName, setEditName] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const started = useRef(false);

  async function run() {
    if (!id) return;
    setFailed(false);
    setStory(null);
    setProgress(5);
    try {
      const { jobId } = await api.startStoryboard(id);
      let done = false;
      let fails = 0;
      while (!done) {
        await new Promise((r) => setTimeout(r, 1500));
        let job;
        try {
          job = await api.getJob(jobId);
          fails = 0;
        } catch (err) {
          fails++;
          if (fails > 15) throw err; // 약 20초 연속 실패 시 포기
          continue; // 일시적 네트워크/ngrok 끊김 → 계속 폴링
        }
        setProgress(job.progress ?? 0);
        if (job.status === 'done') {
          done = true;
          setStory(await api.getStory(id));
        } else if (job.status === 'failed') {
          done = true;
          setFailed(true);
          Alert.alert('생성 실패', job.error ?? '다시 시도해 주세요.');
        }
      }
    } catch (e: any) {
      setFailed(true);
      Alert.alert('오류', e.message);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [id]);

  useEffect(() => {
    if (story) return;
    let i = 0;
    const iv = setInterval(() => {
      i = (i + 1) % MESSAGES.length;
      setMsg(MESSAGES[i]);
    }, 2500);
    return () => clearInterval(iv);
  }, [story]);

  // 의상 다시 뽑기 / 수정
  async function regenCostume(name: string, outfit?: string) {
    if (!story || busyName) return;
    setBusyName(name);
    setEditName(null);
    try {
      const { jobId } = await api.regenerateCostume(story.id, name, outfit);
      let done = false;
      while (!done) {
        await new Promise((r) => setTimeout(r, 1500));
        const job = await api.getJob(jobId);
        if (job.status === 'done') {
          done = true;
          setStory(await api.getStory(story.id));
        } else if (job.status === 'failed') {
          done = true;
          Alert.alert('의상 생성 실패', job.error ?? '다시 시도해 주세요.');
        }
      }
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setBusyName(null);
    }
  }

  const characters = (story?.state?.characters ?? []) as { name?: string; sheetUrl?: string | null }[];
  const bible = ((story?.state as { bible?: Bible } | undefined)?.bible) as Bible | undefined;
  const bibleScene = (no: number) => bible?.scenes?.find((s) => s.no === no);
  const gallery = [
    ...characters.map((c) => ({ name: c.name, sheetUrl: c.sheetUrl ?? undefined, friend: false })),
    ...(bible?.castMembers ?? []).filter((m) => m.sheetUrl).map((m) => ({ name: m.name, sheetUrl: m.sheetUrl, friend: true })),
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.screen }}>
      <Stepper current={3} />
      {!story ? (
        <Card style={{ gap: 12 }}>
          <Text style={styles.h}>스토리보드를 만들고 있어요</Text>
          <Text style={styles.label}>{failed ? '생성에 실패했어요.' : msg}</Text>
          {!failed && (
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(5, progress)}%` }]} />
            </View>
          )}
          <Text style={styles.sub}>전체 흐름과 연출(의상·배경·등장인물)을 먼저 확인하고, 마음에 들면 동화책으로 완성해요.</Text>
          {failed && <Button label="다시 시도" onPress={run} />}
        </Card>
      ) : (
        <>
          <View style={styles.banner}>
            <Text style={styles.bannerTxt}>💡 저렴한 미리보기로 흐름과 연출을 먼저 확인하세요. 마음에 들면 고화질로 완성해요.</Text>
          </View>
          <Card style={{ gap: 10 }}>
            <Text style={styles.h}>{story.title}</Text>
            {story.storyboardUrl ? (
              <Image source={imageSource(story.storyboardUrl)} style={styles.board} resizeMode="cover" />
            ) : (
              <View style={[styles.board, styles.ph]}>
                <Text style={styles.sub}>이미지 없음</Text>
              </View>
            )}
          </Card>

          {gallery.length > 0 && (
            <Card style={{ marginTop: 12, gap: 8 }}>
              <Text style={styles.label}>등장 캐릭터</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {gallery.map((c, i) => (
                    <View key={i} style={{ width: 120 }}>
                      {c.sheetUrl ? (
                        <Image source={imageSource(c.sheetUrl)} style={styles.charSheet} resizeMode="cover" />
                      ) : (
                        <View style={[styles.charSheet, styles.ph]} />
                      )}
                      <Text style={styles.charName} numberOfLines={1}>
                        {c.name}{c.friend ? ' · 친구' : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </Card>
          )}

          {bible && (
            <Card style={{ marginTop: 12, gap: 12 }}>
              <Text style={styles.label}>연출 정보</Text>
              {!!bible.setting && (
                <View>
                  <Text style={styles.specKey}>배경</Text>
                  <Text style={styles.specVal}>{bible.settingKo || bible.setting}</Text>
                </View>
              )}
              {!!(bible.wardrobe && bible.wardrobe.length) && (
                <View style={{ gap: 14 }}>
                  <Text style={styles.specKey}>의상 (이야기 내내 동일 · 마음에 안 들면 바꿔보세요)</Text>
                  {bible.wardrobe!.map((w, i) => {
                    const name = w.name || '';
                    const busy = busyName === name;
                    const editing = editName === name;
                    return (
                      <View key={i} style={styles.wardrobeRow}>
                        {w.refUrl ? (
                          <Image source={imageSource(w.refUrl)} style={styles.wardrobeThumb} resizeMode="cover" />
                        ) : (
                          <View style={[styles.wardrobeThumb, styles.ph]}>
                            <Text style={styles.thumbPh}>👕</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.specName}>{name}</Text>
                          {editing ? (
                            <View style={{ gap: 8, marginTop: 4 }}>
                              <TextInput
                                style={styles.editInput}
                                value={editText}
                                onChangeText={setEditText}
                                placeholder="예: 노란 우비, 빨간 장화"
                                placeholderTextColor={colors.sub}
                                multiline
                              />
                              <View style={styles.rowBtns}>
                                <Pressable style={styles.miniPrimary} onPress={() => regenCostume(name, editText)}>
                                  <Text style={styles.miniPrimaryTxt}>저장 후 다시 그리기</Text>
                                </Pressable>
                                <Pressable style={styles.miniGhost} onPress={() => setEditName(null)}>
                                  <Text style={styles.miniGhostTxt}>취소</Text>
                                </Pressable>
                              </View>
                            </View>
                          ) : (
                            <>
                              <Text style={styles.specVal}>{w.outfitKo || w.outfit}</Text>
                              {busy ? (
                                <View style={styles.rowBusy}>
                                  <ActivityIndicator size="small" color={colors.accent} />
                                  <Text style={styles.busyTxt}>새 의상 그리는 중…</Text>
                                </View>
                              ) : (
                                <View style={styles.rowBtns}>
                                  <Pressable style={styles.miniGhost} onPress={() => regenCostume(name)} disabled={!!busyName}>
                                    <Text style={styles.miniGhostTxt}>🔄 다시 뽑기</Text>
                                  </Pressable>
                                  <Pressable
                                    style={styles.miniGhost}
                                    onPress={() => {
                                      setEditName(name);
                                      setEditText(w.outfitKo || w.outfit || '');
                                    }}
                                    disabled={!!busyName}
                                  >
                                    <Text style={styles.miniGhostTxt}>✏️ 수정</Text>
                                  </Pressable>
                                </View>
                              )}
                            </>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
              {!!(bible.extras && bible.extras.toLowerCase() !== 'none') && (
                <View>
                  <Text style={styles.specKey}>엑스트라</Text>
                  <Text style={styles.specVal}>{bible.extrasKo || bible.extras}</Text>
                </View>
              )}
            </Card>
          )}

          <Text style={[styles.label, { marginTop: 18, marginBottom: 10 }]}>장면 흐름</Text>
          <View style={styles.grid}>
            {story.scenes.map((s) => {
              const bs = bibleScene(s.no);
              return (
                <View key={s.id} style={styles.sbCell}>
                  <View style={styles.sbBadge}>
                    <Text style={styles.sbBadgeTxt}>{s.no}</Text>
                  </View>
                  <Text style={styles.sbTitle} numberOfLines={1}>{s.title}</Text>
                  {!!(bs?.cast && bs.cast.length) && (
                    <Text style={styles.sbCast} numberOfLines={1}>👥 {bs.cast.join(', ')}</Text>
                  )}
                  {!!(bs?.outfitOverride && bs.outfitOverride.length) && (
                    <Text style={styles.sbOverride} numberOfLines={1}>👕 {bs.outfitOverride.map((o) => o.outfitKo || o.outfit).join(', ')}</Text>
                  )}
                  {!!bs?.directionKo && (
                    <Text style={styles.sbDir} numberOfLines={2}>🎬 {bs.directionKo}</Text>
                  )}
                  {!!((bs?.propsKo && bs.propsKo.length) || (bs?.props && bs.props.length)) && (
                    <Text style={styles.sbProps} numberOfLines={1}>🎒 {((bs?.propsKo && bs.propsKo.length ? bs.propsKo : bs?.props) || []).join(', ')}</Text>
                  )}
                  {!!s.text && <Text style={styles.sbText} numberOfLines={3}>{s.text}</Text>}
                </View>
              );
            })}
          </View>

          <Button label="🔄 다시 컨셉 잡기" variant="ghost" onPress={() => router.back()} style={{ marginTop: 16 }} />
          <Button
            label="이 스토리보드로 동화책 만들기"
            onPress={() => router.replace({ pathname: '/create/book', params: { id: story.id, gen: '1' } })}
            style={{ marginTop: 10 }}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: typography.subtitle, fontWeight: '700', color: colors.ink, letterSpacing: typography.headTracking },
  label: { fontSize: 13, color: colors.sub, fontWeight: '700' },
  sub: { fontSize: typography.caption, color: colors.sub, lineHeight: 19 },
  banner: { backgroundColor: colors.accentSoft, borderRadius: 16, padding: 14, marginBottom: 12 },
  bannerTxt: { fontSize: 13, color: colors.accentDeep, fontWeight: '600', lineHeight: 19 },
  specKey: { fontSize: 11, fontWeight: '700', color: colors.accentDeep, marginBottom: 2 },
  specVal: { fontSize: 13.5, color: colors.ink, lineHeight: 20 },
  specName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  wardrobeRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  wardrobeThumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#000' },
  thumbPh: { fontSize: 22, textAlign: 'center', lineHeight: 56 },
  rowBtns: { flexDirection: 'row', gap: 8, marginTop: 6 },
  rowBusy: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 },
  busyTxt: { fontSize: 12.5, color: colors.accentDeep, fontWeight: '600' },
  miniGhost: { borderWidth: 1.5, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  miniGhostTxt: { fontSize: 12.5, color: colors.ink, fontWeight: '600' },
  miniPrimary: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  miniPrimaryTxt: { fontSize: 12.5, color: '#fff', fontWeight: '700' },
  editInput: { backgroundColor: '#FBF7F0', borderWidth: 1.5, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.ink, minHeight: 44 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sbCell: { width: '47.8%', flexGrow: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 13, gap: 5, ...shadows.soft },
  sbBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sbBadgeTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sbTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 2 },
  sbCast: { fontSize: 11.5, color: colors.green, fontWeight: '600' },
  sbOverride: { fontSize: 11.5, color: colors.accentDeep, fontWeight: '600' },
  sbDir: { fontSize: 11.5, color: colors.sub, fontWeight: '600' },
  sbProps: { fontSize: 11.5, color: colors.green, fontWeight: '600' },
  sbText: { fontSize: 12.5, color: colors.sub, lineHeight: 18 },
  track: { height: 8, backgroundColor: colors.accentSoft, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.accent, borderRadius: 4 },
  board: { width: '100%', aspectRatio: 1.5, borderRadius: radius.card, backgroundColor: '#000' },
  ph: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
  charSheet: { width: 120, aspectRatio: 1.4, borderRadius: radius.button, backgroundColor: '#000' },
  charName: { fontSize: typography.caption, color: colors.ink, marginTop: 4, textAlign: 'center' },
});
