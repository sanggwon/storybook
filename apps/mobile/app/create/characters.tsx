import { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { CharacterRecord } from '@storybook/shared';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { Stepper } from '../../src/components/Stepper';
import { api, imageSource } from '../../src/api/client';
import { colors, radius, typography } from '../../src/design/tokens';

const ROLES = ['주인공', '친구', '형제·자매', '반려동물', '가족', '조력자', '악당'];
const AGES = ['3', '4', '5', '6', '7', '8', '직접 입력'];
const PERSONAS = ['용감해요', '다정해요', '호기심 많아요', '장난꾸러기', '수줍어요', '씩씩해요', '직접 입력'];
const MESSAGES = ['아이 얼굴을 살펴보는 중…', '닮은 캐릭터를 그리는 중…', '표정을 그리는 중…', '색을 입히는 중…', '거의 다 됐어요…'];

function Chips({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.chips}>
      {items.map((it) => (
        <Pressable key={it} onPress={() => onChange(it)} style={[styles.chip, value === it && styles.chipOn]}>
          <Text style={[styles.chipTxt, value === it && styles.chipTxtOn]}>{it === '직접 입력' ? it : it.match(/^\d+$/) ? `${it}세` : it}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function Characters() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [role, setRole] = useState('주인공');
  const [ageSel, setAgeSel] = useState('');
  const [ageCustom, setAgeCustom] = useState('');
  const [personaSel, setPersonaSel] = useState('');
  const [personaCustom, setPersonaCustom] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; base64?: string | null } | null>(null);

  const [list, setList] = useState<CharacterRecord[]>([]);
  const [active, setActive] = useState<{ jobId: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState(MESSAGES[0]);
  const [creating, setCreating] = useState(false);
  const [reviseId, setReviseId] = useState<string | null>(null);
  const [reviseText, setReviseText] = useState('');

  async function loadCharacters() {
    try {
      setList(await api.listCharacters());
    } catch {
      /* ignore */
    }
  }

  // 화면에 들어올 때마다(새로 진입·복귀) 기존 캐릭터를 다시 불러온다
  useFocusEffect(
    useCallback(() => {
      loadCharacters();
    }, [])
  );

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const job = await api.getJob(active.jobId);
        if (cancelled) return;
        setProgress(job.progress ?? 0);
        if (job.status === 'done' || job.status === 'failed') {
          if (job.status === 'failed') Alert.alert('생성 실패', job.error ?? '다시 시도해 주세요.');
          setActive(null);
          await loadCharacters();
        }
      } catch {
        /* keep polling */
      }
    };
    const iv = setInterval(tick, 1500);
    tick();
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    let i = 0;
    setMsg(MESSAGES[0]);
    const iv = setInterval(() => {
      i = (i + 1) % MESSAGES.length;
      setMsg(MESSAGES[i]);
    }, 2500);
    return () => clearInterval(iv);
  }, [active]);

  function resolveAge(): number | undefined {
    const v = ageSel === '직접 입력' ? ageCustom : ageSel;
    const n = Number(v);
    return v && !Number.isNaN(n) ? n : undefined;
  }
  function resolvePersona(): string | undefined {
    const v = personaSel === '직접 입력' ? personaCustom.trim() : personaSel;
    return v || undefined;
  }

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (!res.canceled && res.assets[0]) setPhoto({ uri: res.assets[0].uri, base64: res.assets[0].base64 });
  }

  async function create() {
    if (!photo && !name.trim()) {
      Alert.alert('입력이 필요해요', '아이 사진을 올리거나 캐릭터 이름을 입력해 주세요.');
      return;
    }
    setCreating(true);
    try {
      const r = await api.createCharacter({
        name: name.trim() || undefined,
        role,
        age: resolveAge(),
        personality: resolvePersona(),
        photoBase64: photo?.base64 ? `data:image/jpeg;base64,${photo.base64}` : undefined,
      });
      setActive({ jobId: r.jobId });
      setProgress(5);
      setName('');
      setAgeSel('');
      setAgeCustom('');
      setPersonaSel('');
      setPersonaCustom('');
      setPhoto(null);
      await loadCharacters();
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setCreating(false);
    }
  }

  async function revise(id: string) {
    const fb = reviseText.trim();
    if (!fb) return;
    try {
      const r = await api.reviseCharacter(id, fb);
      setReviseId(null);
      setReviseText('');
      setActive({ jobId: r.jobId });
      setProgress(5);
      await loadCharacters();
    } catch (e: any) {
      Alert.alert('오류', e.message);
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteCharacter(id);
      await loadCharacters();
    } catch (e: any) {
      Alert.alert('오류', e.message);
    }
  }

  const busy = !!active || creating;
  const doneIds = list.filter((c) => c.status === 'done').map((c) => c.id);

  return (
    <Screen scroll>
      <Stepper current={1} />

      <Pressable onPress={pickPhoto} style={styles.upload}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.uploadPic} />
        ) : (
          <>
            <View style={styles.uploadIcon}>
              <Text style={{ fontSize: 26 }}>📷</Text>
            </View>
            <Text style={styles.uploadTitle}>아이 사진 올리기</Text>
            <Text style={styles.sub}>사진 없이 이름·역할만으로도 만들 수 있어요</Text>
          </>
        )}
      </Pressable>

      <Card style={{ gap: 12, marginTop: 14 }}>
        <Text style={styles.h}>캐릭터 정보</Text>

        <TextField label="이름" value={name} onChangeText={setName} placeholder="예: 민준 / 토토(강아지)" />

        <Text style={styles.label}>나이</Text>
        <Chips items={AGES} value={ageSel} onChange={setAgeSel} />
        {ageSel === '직접 입력' && (
          <TextField value={ageCustom} onChangeText={setAgeCustom} keyboardType="number-pad" placeholder="나이 입력 (숫자)" />
        )}

        <Text style={styles.label}>역할</Text>
        <Chips items={ROLES} value={role} onChange={setRole} />

        <Text style={styles.label}>성격·특징</Text>
        <Chips items={PERSONAS} value={personaSel} onChange={setPersonaSel} />
        {personaSel === '직접 입력' && (
          <TextField value={personaCustom} onChangeText={setPersonaCustom} placeholder="예: 호기심 많고 장난꾸러기" />
        )}

        <Button label="캐릭터 만들기" onPress={create} loading={creating} disabled={busy} />
      </Card>

      {active && (
        <Card style={{ marginTop: 12, gap: 10 }}>
          <Text style={styles.label}>{msg}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(5, progress)}%` }]} />
          </View>
          <Text style={styles.sub}>앱을 닫지 않고 잠시만 기다려 주세요.</Text>
        </Card>
      )}

      {list.map((c) => (
        <Card key={c.id} style={{ marginTop: 12, gap: 8 }}>
          <View style={styles.cardHead}>
            <View style={styles.nameWrap}>
              <Text style={styles.charName}>{c.name}</Text>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillTxt}>{c.role}</Text>
              </View>
            </View>
            <View style={[styles.statusPill, c.status === 'done' ? styles.okBg : c.status === 'failed' ? styles.badBg : styles.waitBg]}>
              <Text style={[styles.status, c.status === 'done' ? styles.ok : c.status === 'failed' ? styles.bad : styles.wait]}>
                {c.status === 'done' ? '완료' : c.status === 'failed' ? '실패' : '생성중'}
              </Text>
            </View>
          </View>

          {c.sheetUrl ? (
            <Image source={imageSource(c.sheetUrl)} style={styles.sheet} resizeMode="cover" />
          ) : (
            <View style={[styles.sheet, styles.sheetPh]}>
              <Text style={styles.sub}>{c.status === 'failed' ? '생성 실패' : '생성 중…'}</Text>
            </View>
          )}

          {!!c.personality && <Text style={styles.sub}>성격: {c.personality}</Text>}

          {c.status === 'done' && (
            <View style={styles.actions}>
              <Button label="🔄 수정" variant="ghost" onPress={() => setReviseId(reviseId === c.id ? null : c.id)} style={{ flex: 1 }} />
              <Button label="삭제" variant="ghost" onPress={() => remove(c.id)} style={{ flex: 1 }} />
            </View>
          )}
          {c.status !== 'done' && (
            <Button label="삭제" variant="ghost" onPress={() => remove(c.id)} />
          )}

          {reviseId === c.id && (
            <View style={{ gap: 8 }}>
              <TextField label="수정 요청" value={reviseText} onChangeText={setReviseText} placeholder="예: 앞머리를 내려줘, 안경 씌워줘" />
              <Button label="이대로 다시 만들기" onPress={() => revise(c.id)} disabled={busy} />
            </View>
          )}
        </Card>
      ))}

      <Button
        label={`다음 — 이야기 만들기${doneIds.length ? ` (캐릭터 ${doneIds.length})` : ''}`}
        onPress={() => router.push({ pathname: '/create/concept', params: { ids: doneIds.join(',') } })}
        disabled={doneIds.length === 0 || busy}
        style={{ marginTop: 16 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: typography.subtitle, fontWeight: '700', color: colors.ink, letterSpacing: typography.headTracking },
  sub: { fontSize: typography.caption, color: colors.sub, lineHeight: 19 },
  label: { fontSize: 13, color: colors.sub, fontWeight: '700' },
  upload: {
    borderWidth: 2,
    borderColor: '#DEC9B0',
    borderStyle: 'dashed',
    backgroundColor: '#FBF4EA',
    borderRadius: 22,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 4,
  },
  uploadIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  uploadTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  uploadPic: { width: 120, height: 120, borderRadius: 18 },
  nameWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rolePill: { backgroundColor: colors.green, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  rolePillTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  okBg: { backgroundColor: '#E6EFE2' },
  badBg: { backgroundColor: '#F7E3DF' },
  waitBg: { backgroundColor: colors.bg2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipTxt: { fontSize: 13, color: colors.sub },
  chipTxtOn: { color: colors.accent, fontWeight: '600' },
  track: { height: 8, backgroundColor: colors.accentSoft, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.accent, borderRadius: 4 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  charName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  status: { fontSize: 12, fontWeight: '700' },
  ok: { color: colors.green },
  bad: { color: '#C0392B' },
  wait: { color: colors.sub },
  sheet: { width: '100%', aspectRatio: 1.5, borderRadius: radius.card, backgroundColor: '#000' },
  sheetPh: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
  actions: { flexDirection: 'row', gap: 8 },
});
