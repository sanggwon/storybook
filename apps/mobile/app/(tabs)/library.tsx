import { useCallback, useState } from 'react';
import { Text, View, Image, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { StoryRecord } from '@storybook/shared';
import { Screen } from '../../src/components/Screen';
import { api, imageSource } from '../../src/api/client';
import { colors, radius, typography, shadows } from '../../src/design/tokens';

export default function Library() {
  const router = useRouter();
  const [stories, setStories] = useState<StoryRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let on = true;
      api.listStories().then((s) => on && setStories(s)).catch(() => {});
      return () => {
        on = false;
      };
    }, [])
  );

  if (stories.length === 0) {
    return (
      <Screen center>
        <Text style={styles.emoji}>📚</Text>
        <Text style={styles.title}>내 책장</Text>
        <Text style={styles.sub}>아직 만든 동화책이 없어요.{'\n'}홈에서 첫 동화를 만들어 보세요.</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>내 책장</Text>
      {stories.map((s) => {
        const cover = s.scenes.find((x) => x.imageUrl)?.imageUrl ?? s.storyboardUrl ?? undefined;
        const label = s.status === 'done' ? '완성' : s.status === 'storyboard' ? '스토리보드' : '작성중';
        return (
          <Pressable
            key={s.id}
            style={styles.row}
            onPress={() => router.push({ pathname: '/create/book', params: { id: s.id } })}
          >
            {cover ? <Image source={imageSource(cover)} style={styles.cover} /> : <View style={[styles.cover, styles.ph]} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.bookTitle} numberOfLines={1}>
                {s.title}
              </Text>
              <View style={styles.metaRow}>
                <View style={[styles.statusPill, s.status === 'done' ? styles.donePill : styles.draftPill]}>
                  <Text style={[styles.statusTxt, s.status === 'done' ? styles.doneTxt : styles.draftTxt]}>{label}</Text>
                </View>
                <Text style={styles.meta}>{s.scenes.length}장면</Text>
              </View>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emoji: { fontSize: 48, textAlign: 'center' },
  title: { fontSize: typography.title, fontWeight: '700', color: colors.ink, marginTop: 8, marginBottom: 12, textAlign: 'left' },
  sub: { fontSize: typography.body, color: colors.sub, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  row: { flexDirection: 'row', gap: 13, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, padding: 12, marginBottom: 12, ...shadows.soft },
  cover: { width: 84, height: 62, borderRadius: 12, backgroundColor: '#000' },
  ph: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
  bookTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  donePill: { backgroundColor: '#E6EFE2' },
  draftPill: { backgroundColor: colors.accentSoft },
  statusTxt: { fontSize: 11, fontWeight: '700' },
  doneTxt: { color: colors.green },
  draftTxt: { color: colors.accentDeep },
  meta: { fontSize: typography.caption, color: colors.sub },
  chev: { fontSize: 24, color: colors.sub },
});
