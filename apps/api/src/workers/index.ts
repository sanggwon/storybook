import { Worker } from 'bullmq';
import { connection } from '../queue/connection';
import { env } from '../env';
import { prisma } from '../db/client';
import { ensureStorage, saveImageB64, readImageB64FromUrl } from '../services/storage';
import { genImageFromPrompt, genImageFromRef, genImageFromRefs, describeCharacter, generateSceneTexts, generateScenePrompts, refineSceneTexts, generateStoryBible } from '../services/openai';
import { charSheetPrompt, castMemberSheetPrompt, draftSheetPrompt, costumeRefPrompt, SCENE_TEXTS_SYSTEM, SCENE_PROMPTS_SYSTEM, SCENE_REFINE_SYSTEM, STORY_BIBLE_SYSTEM, REF_NOTE, STYLE_DIR, NOTEXT } from '../services/prompts';

const WORKER_OPTS = { connection, lockDuration: 180000 };

async function setJob(id: string, data: Record<string, unknown>) {
  await prisma.job.update({ where: { id }, data }).catch(() => {});
}

type CharRef = { name: string; b64: string };

// ===== 스토리 바이블(연출 스펙) 타입 & 헬퍼 =====
type WardrobeItem = { name?: string; outfit?: string; outfitKo?: string; refUrl?: string };
type BibleScene = { no: number; cast?: string[]; location?: string; time?: string; shot?: string; angle?: string; lighting?: string; emotion?: string; outfitOverride?: WardrobeItem[]; props?: string[]; propsKo?: string[]; directionKo?: string; extras?: string };
type CastMember = { name?: string; desc?: string; descKo?: string; outfit?: string; outfitKo?: string; sheetUrl?: string; lockedDesc?: string };
type Bible = { setting?: string; castMembers?: CastMember[]; wardrobe?: WardrobeItem[]; extras?: string; scenes?: BibleScene[]; sig?: string; costumeRefs?: { name?: string; outfit?: string; refUrl?: string }[] };

// 주인공(사용자 등록) + 바이블이 만든 조연을 하나의 캐릭터 목록으로 합침
type CharLike = { name?: string | null; sheetUrl?: string | null; lockedDesc?: string | null };
function combinedChars(stateChars: CharLike[] | undefined, bible: Bible | undefined): CharLike[] {
  const extra = (bible?.castMembers || [])
    .filter((m) => m.name && m.sheetUrl)
    .map((m) => ({ name: m.name, sheetUrl: m.sheetUrl, lockedDesc: m.lockedDesc }));
  return [...(stateChars || []), ...extra];
}

function getBible(state: unknown): Bible | undefined {
  const b = (state as { bible?: Bible } | null)?.bible;
  return b && typeof b === 'object' ? b : undefined;
}
function bibleScene(bible: Bible | undefined, no: number): BibleScene | undefined {
  return bible?.scenes?.find((s) => s.no === no);
}
function outfitFor(bible: Bible | undefined, name: string, no: number): string {
  const ov = bibleScene(bible, no)?.outfitOverride?.find((o) => o.name === name)?.outfit;
  if (ov) return ov;
  return bible?.wardrobe?.find((w) => w.name === name)?.outfit || '';
}

// 캐릭터 시트들을 한 번씩 읽어 이름과 함께 보관 (정체성/폴백용)
async function loadCharRefs(characters?: { name?: string | null; sheetUrl?: string | null }[]): Promise<CharRef[]> {
  const out: CharRef[] = [];
  for (const c of characters || []) {
    if (c.sheetUrl) {
      const b = await readImageB64FromUrl(c.sheetUrl);
      if (b) out.push({ name: (c.name || '').trim(), b64: b });
    }
  }
  return out;
}

// 의상 레퍼런스 맵: "이름|의상" → b64. (기본 + 장면 예외 의상 모두)
async function loadCostumeMap(bible: Bible | undefined): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const r of bible?.costumeRefs || []) {
    if (r.name && r.outfit && r.refUrl) {
      const b = await readImageB64FromUrl(r.refUrl);
      if (b) map[`${r.name}|${r.outfit}`] = b;
    }
  }
  for (const w of bible?.wardrobe || []) {
    const k = `${w.name}|${w.outfit}`;
    if (w.name && w.outfit && w.refUrl && !map[k]) {
      const b = await readImageB64FromUrl(w.refUrl);
      if (b) map[k] = b;
    }
  }
  return map;
}

// 한 장면의 등장 캐릭터: 바이블 우선 → 내레이션 이름매칭 → 전체
function castForScene(all: CharRef[], bible: Bible | undefined, sc: { no: number; text?: string | null }): CharRef[] {
  const names = bibleScene(bible, sc.no)?.cast;
  if (names && names.length) {
    const picked = all.filter((c) => c.name && names.includes(c.name));
    if (picked.length) return picked;
  }
  const t = sc.text || '';
  const byText = all.filter((c) => c.name && t.includes(c.name));
  return byText.length ? byText : all;
}

// 장면 레퍼런스: 그 장면의 의상(기본 또는 예외)에 맞는 레퍼런스, 없으면 시트
function sceneRefsByOutfit(cast: CharRef[], bible: Bible | undefined, no: number, map: Record<string, string>): string[] {
  return cast.map((c) => map[`${c.name}|${outfitFor(bible, c.name, no)}`] || c.b64);
}

// 등장인물 수·이름 명시 → 같은 캐릭터 복제/엑스트라 추가 방지
function castClause(cast: CharRef[]): string {
  const names = cast.map((c) => c.name).filter(Boolean);
  if (!names.length) {
    return ' Render the character(s) the scene calls for, each EXACTLY ONCE (no duplicates of them). Other people the narration mentions (friends, family, a crowd) may appear as distinct extras.';
  }
  return (
    ` SCENE CAST: EXACTLY ${names.length} character${names.length > 1 ? 's' : ''}: ${names.join(', ')}. ` +
    'Render each of them EXACTLY ONCE and never duplicate/clone them. You MAY add other people the story calls for (e.g., friends, family, a crowd) as separate distinct characters.'
  );
}

// 배경·의상·소품·엑스트라 등 연출 스펙을 프롬프트에 주입
function continuityClause(bible: Bible | undefined, no: number, cast: CharRef[]): string {
  const bs = bibleScene(bible, no);
  const bits: string[] = [];
  const setting = [bible?.setting, bs?.location, bs?.time].filter(Boolean).join(', ');
  if (setting) bits.push(`SETTING: ${setting}.`);
  const outfits = cast
    .map((c) => {
      const o = outfitFor(bible, c.name, no);
      return o ? `${c.name} wears ${o}` : '';
    })
    .filter(Boolean);
  if (outfits.length) bits.push(`OUTFIT for THIS scene — dress each character exactly as written, matching their costume reference for this outfit (it may differ from other scenes if the story calls for it): ${outfits.join('; ')}.`);
  const shotAngle = [bs?.shot, bs?.angle].filter(Boolean).join(', ');
  if (shotAngle) bits.push(`SHOT: ${shotAngle}.`);
  if (bs?.lighting) bits.push(`LIGHTING: ${bs.lighting}.`);
  if (bs?.emotion) bits.push(`EXPRESSION: the main character looks ${bs.emotion}.`);
  if (bs?.props?.length) bits.push(`PROPS: ${bs.props.join(', ')}.`);
  const extras = bs?.extras ?? bible?.extras;
  if (extras && extras.toLowerCase() !== 'none') bits.push(`EXTRAS: ${extras}.`);
  return bits.length ? ' ' + bits.join(' ') : '';
}

// SCENE_PROMPTS_SYSTEM 입력용: 장면별 스펙을 함께 전달
function promptStateForScenes(
  bible: Bible | undefined,
  characters: { name?: string | null; role?: string; lockedDesc?: string | null }[] | undefined,
  styleAnchor: string | undefined,
  scenes: { no: number; title?: string | null; beat?: string | null; text?: string | null }[]
) {
  return {
    characters,
    style_anchor: styleAnchor,
    scenes: scenes.map((s) => {
      const bs = bibleScene(bible, s.no);
      const castNames = bs?.cast ?? (characters || []).map((c) => c.name).filter(Boolean);
      return {
        no: s.no,
        title: s.title,
        beat: s.beat,
        text: s.text,
        spec: {
          cast: castNames,
          outfits: (castNames as string[]).map((n) => ({ name: n, outfit: outfitFor(bible, n, s.no) })),
          location: bs?.location,
          time: bs?.time,
          shot: bs?.shot,
          angle: bs?.angle,
          lighting: bs?.lighting,
          emotion: bs?.emotion,
          props: bs?.props,
          extras: bs?.extras ?? bible?.extras ?? 'none',
        },
      };
    }),
  };
}

// 현재 이야기(내레이션) 시그니처 — 바뀌면 연출 정보를 다시 맞춘다
function storySig(topic: string | undefined, scenes: { no: number; text?: string | null }[]): string {
  return [topic || '', ...scenes.map((s) => `${s.no}#${(s.text || '').trim().length}#${(s.text || '').trim().slice(0, 48)}`)].join('|');
}

type BibleState = {
  topic?: string;
  style?: string;
  style_anchor?: string;
  characters?: { name?: string; role?: string; sheetUrl?: string | null; lockedDesc?: string | null }[];
};

// 연출 스펙(바이블) + 이야기별 의상 레퍼런스를 현재 내레이션 기준으로 생성
async function buildBible(
  state: BibleState,
  scenesWithText: { no: number; title?: string | null; beat?: string | null; text?: string | null }[],
  sig: string
): Promise<Bible | undefined> {
  let bible: Bible | undefined;
  try {
    const raw = await generateStoryBible(STORY_BIBLE_SYSTEM, {
      topic: state.topic,
      style: state.style,
      style_anchor: state.style_anchor,
      characters: (state.characters || []).map((c) => ({ name: c.name, role: c.role, lockedDesc: c.lockedDesc })),
      scenes: scenesWithText.map((s) => ({ no: s.no, title: s.title, beat: s.beat, text: s.text })),
    });
    bible = raw as Bible;
  } catch (err) {
    console.warn('[bible] generate skipped', err);
    return undefined;
  }

  // 이야기에 등장하는 이름 있는 조연(친구/가족 등) → 사진 없이 캐릭터 시트 생성해 일관성 확보
  for (const m of bible.castMembers || []) {
    if (!m.name) continue;
    try {
      const sp = castMemberSheetPrompt({ name: m.name, desc: m.desc, outfit: m.outfit, styleAnchor: state.style_anchor });
      const b64 = await genImageFromPrompt(sp, '1024x1024', 'low');
      m.sheetUrl = await saveImageB64(b64);
      try {
        m.lockedDesc = await describeCharacter(b64);
      } catch {
        m.lockedDesc = m.desc || '';
      }
      // 조연 기본 의상도 wardrobe에 편입 → 의상 표시/레퍼런스 기계장치를 그대로 재사용
      if (m.outfit && !(bible.wardrobe || []).some((w) => w.name === m.name)) {
        (bible.wardrobe ||= []).push({ name: m.name, outfit: m.outfit, outfitKo: m.outfitKo });
      }
    } catch (err) {
      console.warn('[bible] cast member sheet failed', m.name, err);
    }
  }
  // 주인공 + 시트가 생성된 조연을 합친 캐릭터 풀 (의상 레퍼런스 조회용)
  const charPool = combinedChars(state.characters, bible);

  // 기본 의상 + 장면별 예외 의상의 고유 조합마다 레퍼런스 1장 생성
  const distinct: { name: string; outfit: string }[] = [];
  const seen = new Set<string>();
  const addOutfit = (name?: string, outfit?: string) => {
    if (!name || !outfit) return;
    const k = `${name}|${outfit}`;
    if (seen.has(k)) return;
    seen.add(k);
    distinct.push({ name, outfit });
  };
  for (const w of bible.wardrobe || []) addOutfit(w.name, w.outfit);
  for (const sc of bible.scenes || []) for (const o of sc.outfitOverride || []) addOutfit(o.name, o.outfit);

  const costumeRefs: { name: string; outfit: string; refUrl?: string }[] = [];
  const sheetCache: Record<string, string | null> = {};
  for (const d of distinct) {
    const ch = charPool.find((c) => c.name === d.name);
    if (!ch?.sheetUrl) continue;
    try {
      if (!(ch.sheetUrl in sheetCache)) sheetCache[ch.sheetUrl] = await readImageB64FromUrl(ch.sheetUrl);
      const sheetB64 = sheetCache[ch.sheetUrl];
      if (!sheetB64) continue;
      const cp = costumeRefPrompt({ name: d.name, lockedDesc: ch.lockedDesc, outfit: d.outfit, styleAnchor: state.style_anchor });
      const url = await saveImageB64(await genImageFromRef(cp, sheetB64, '1024x1024', 'low'));
      costumeRefs.push({ name: d.name, outfit: d.outfit, refUrl: url });
      const w = (bible.wardrobe || []).find((x) => x.name === d.name && x.outfit === d.outfit);
      if (w) w.refUrl = url; // 기본 의상은 화면 표시용으로도 연결
    } catch (err) {
      console.warn('[bible] costume ref failed', d.name, d.outfit, err);
    }
  }
  bible.costumeRefs = costumeRefs;
  bible.sig = sig;
  return bible;
}

// 이야기가 바뀌었으면(시그니처 불일치) 연출 정보를 자동으로 다시 생성해 저장하고 반환
async function ensureBible(storyId: string): Promise<Bible | undefined> {
  const story = await prisma.story.findUnique({ where: { id: storyId }, include: { scenes: { orderBy: { no: 'asc' } } } });
  if (!story) return undefined;
  const state = story.state as BibleState;
  const scenes = story.scenes.map((s) => ({ no: s.no, title: s.title, beat: s.beat, text: s.text }));
  const sig = storySig(state.topic, scenes);
  const existing = getBible(story.state);
  if (existing && existing.sig === sig) return existing; // 이야기 그대로 → 재생성 불필요
  const bible = await buildBible(state, scenes, sig);
  if (!bible) return existing;
  const newState = { ...(story.state as Record<string, unknown>), bible };
  await prisma.story.update({ where: { id: storyId }, data: { state: newState as object } });
  return bible;
}

const characterWorker = new Worker(
  'character',
  async (job) => {
    const d = job.data as {
      jobId: string;
      characterId: string;
      name?: string;
      role?: string;
      personality?: string;
      style: string;
      photoBase64?: string;
      revise?: boolean;
      feedback?: string;
    };

    await ensureStorage();
    await setJob(d.jobId, { status: 'running', progress: 10 });

    try {
      let b64: string;

      if (d.revise) {
        const character = await prisma.character.findUnique({ where: { id: d.characterId } });
        const prompt = charSheetPrompt({
          style: d.style,
          name: character?.name,
          role: character?.role,
          personality: character?.personality,
          hasPhoto: true,
          feedback: d.feedback,
        });
        await setJob(d.jobId, { progress: 30 });
        const refB64 = character?.sheetUrl ? await readImageB64FromUrl(character.sheetUrl) : null;
        b64 = refB64 ? await genImageFromRef(prompt, refB64) : await genImageFromPrompt(prompt);
      } else {
        const prompt = charSheetPrompt({
          style: d.style,
          name: d.name,
          role: d.role,
          age: (d as { age?: number }).age,
          personality: d.personality,
          hasPhoto: !!d.photoBase64,
        });
        await setJob(d.jobId, { progress: 30 });
        b64 = d.photoBase64 ? await genImageFromRef(prompt, d.photoBase64) : await genImageFromPrompt(prompt);
      }

      await setJob(d.jobId, { progress: 70 });
      const url = await saveImageB64(b64);

      let lockedDesc = '';
      try {
        lockedDesc = await describeCharacter(b64);
      } catch {
        /* 설명 추출 실패해도 레퍼런스 이미지로 일관성 유지 */
      }
      await setJob(d.jobId, { progress: 90 });

      await prisma.character.update({
        where: { id: d.characterId },
        data: { sheetUrl: url, lockedDesc, status: 'done' },
      });
      await setJob(d.jobId, { status: 'done', progress: 100, resultUrl: url });
      return { url };
    } catch (e) {
      await setJob(d.jobId, { status: 'failed', error: String(e).slice(0, 300) });
      await prisma.character.update({ where: { id: d.characterId }, data: { status: 'failed' } }).catch(() => {});
      throw e;
    }
  },
  WORKER_OPTS
);

characterWorker.on('completed', (job) => console.log(`[character] done ${job.id}`));
characterWorker.on('failed', (job, err) => console.error(`[character] failed ${job?.id}`, err));

// 스토리보드: 내레이션 → 연출 스펙(바이블) → 이야기별 의상 레퍼런스 → 미리보기 이미지
const storyboardWorker = new Worker(
  'storyboard',
  async (job) => {
    const d = job.data as { jobId: string; storyId: string };
    await ensureStorage();
    await setJob(d.jobId, { status: 'running', progress: 10 });
    try {
      const story = await prisma.story.findUnique({ where: { id: d.storyId } });
      if (!story) throw new Error('story not found');
      const state = story.state as {
        topic?: string;
        style?: string;
        style_anchor?: string;
        characters?: { name?: string; role?: string; sheetUrl?: string | null; lockedDesc?: string | null }[];
        scenes?: { no: number; title?: string; beat?: string }[];
      };

      await setJob(d.jobId, { progress: 20 });
      const draft = await generateSceneTexts(SCENE_TEXTS_SYSTEM, state);
      let texts = draft;
      try {
        texts = await refineSceneTexts(SCENE_REFINE_SYSTEM, state, draft); // 초안 검토·보강
      } catch (err) {
        console.warn('[storyboard] refine skipped', err);
      }
      for (const sc of state.scenes || []) {
        await prisma.scene.updateMany({ where: { storyId: d.storyId, no: sc.no }, data: { text: texts[sc.no] ?? draft[sc.no] ?? null } });
      }

      // 연출 스펙(바이블) + 의상 레퍼런스: 방금 만든 내레이션 기준으로 생성
      await setJob(d.jobId, { progress: 45 });
      const scenesForBible = (state.scenes || []).map((s) => ({ no: s.no, title: s.title, beat: s.beat, text: texts[s.no] ?? draft[s.no] ?? '' }));
      const bible = await buildBible(state, scenesForBible, storySig(state.topic, scenesForBible));

      await setJob(d.jobId, { progress: 75 });
      const refs = (await loadCharRefs(state.characters)).map((r) => r.b64);
      const prompt = draftSheetPrompt(state);
      const b64 = await genImageFromRefs(prompt, refs);

      await setJob(d.jobId, { progress: 90 });
      const url = await saveImageB64(b64);
      const newState = { ...(story.state as Record<string, unknown>), ...(bible ? { bible } : {}) };
      await prisma.story.update({ where: { id: d.storyId }, data: { storyboardUrl: url, status: 'storyboard', state: newState as object } });
      await setJob(d.jobId, { status: 'done', progress: 100, resultUrl: url });
      return { url };
    } catch (e) {
      await setJob(d.jobId, { status: 'failed', error: String(e).slice(0, 300) });
      throw e;
    }
  },
  WORKER_OPTS
);
storyboardWorker.on('completed', (job) => console.log(`[storyboard] done ${job.id}`));
storyboardWorker.on('failed', (job, err) => console.error(`[storyboard] failed ${job?.id}`, err));

// 단일 장면 재생성 ("이 페이지 다시 그리기")
async function regenerateScene(d: { jobId: string; storyId: string; sceneId: string }) {
  await ensureStorage();
  await setJob(d.jobId, { status: 'running', progress: 20 });
  try {
    const story = await prisma.story.findUnique({ where: { id: d.storyId }, include: { scenes: true } });
    const scene = story?.scenes.find((s) => s.id === d.sceneId);
    if (!story || !scene) throw new Error('scene not found');
    const state = story.state as {
      characters?: { name?: string; sheetUrl?: string | null; lockedDesc?: string | null }[];
      style_anchor?: string;
    };
    const bible = await ensureBible(d.storyId);
    const chars = combinedChars(state.characters, bible);
    const allRefs = await loadCharRefs(chars);
    const costume = await loadCostumeMap(bible);

    let prompt = scene.prompt ?? '';
    if (!prompt) {
      const map = await generateScenePrompts(
        SCENE_PROMPTS_SYSTEM,
        promptStateForScenes(bible, chars, state.style_anchor, [
          { no: scene.no, title: scene.title, beat: scene.beat, text: scene.text },
        ])
      );
      prompt = map[scene.no] || `${scene.title} ${scene.beat}`;
    }
    const cast = castForScene(allRefs, bible, scene);
    const refs = sceneRefsByOutfit(cast, bible, scene.no, costume);
    await setJob(d.jobId, { progress: 55 });
    const full = prompt + REF_NOTE + castClause(cast) + continuityClause(bible, scene.no, cast) + STYLE_DIR + NOTEXT;
    const b64 = await genImageFromRefs(full, refs, '1536x1024', env.bookQuality);
    const url = await saveImageB64(b64);
    await prisma.scene.update({ where: { id: scene.id }, data: { imageUrl: url, prompt } });
    await setJob(d.jobId, { status: 'done', progress: 100, resultUrl: url });
    return { url };
  } catch (e) {
    await setJob(d.jobId, { status: 'failed', error: String(e).slice(0, 300) });
    throw e;
  }
}

// 의상 레퍼런스 재생성/수정 ("다시 뽑기" 또는 새 의상으로 교체")
async function regenerateCostume(d: { jobId: string; storyId: string; name: string; outfit?: string }) {
  await ensureStorage();
  await setJob(d.jobId, { status: 'running', progress: 25 });
  try {
    const story = await prisma.story.findUnique({ where: { id: d.storyId } });
    if (!story) throw new Error('story not found');
    const state = story.state as {
      style_anchor?: string;
      characters?: { name?: string; sheetUrl?: string | null; lockedDesc?: string | null }[];
    };
    const bible: Bible = getBible(story.state) || {};
    if (!bible.wardrobe) bible.wardrobe = [];
    const chars = combinedChars(state.characters, bible);
    const ch = chars.find((c) => c.name === d.name);
    if (!ch?.sheetUrl) throw new Error('character sheet not found');
    let item = bible.wardrobe.find((w) => w.name === d.name);
    if (!item) {
      item = { name: d.name };
      bible.wardrobe.push(item);
    }
    const outfit = (d.outfit && d.outfit.trim()) || item.outfit || 'a simple everyday outfit';
    item.outfit = outfit;
    if (d.outfit && d.outfit.trim()) item.outfitKo = d.outfit.trim(); // 부모가 입력한 표시용 텍스트
    await setJob(d.jobId, { progress: 50 });
    const sheetB64 = await readImageB64FromUrl(ch.sheetUrl);
    if (!sheetB64) throw new Error('sheet read failed');
    const p = costumeRefPrompt({ name: d.name, lockedDesc: ch.lockedDesc, outfit, styleAnchor: state.style_anchor });
    const cb64 = await genImageFromRef(p, sheetB64, '1024x1024', 'low');
    item.refUrl = await saveImageB64(cb64);
    // 의상 레퍼런스 맵(costumeRefs)에도 반영 (장면 생성이 이 맵을 사용)
    if (!bible.costumeRefs) bible.costumeRefs = [];
    const cri = bible.costumeRefs.findIndex((r) => r.name === d.name && r.outfit === outfit);
    if (cri >= 0) bible.costumeRefs[cri].refUrl = item.refUrl;
    else bible.costumeRefs.push({ name: d.name, outfit, refUrl: item.refUrl });
    const newState = { ...(story.state as Record<string, unknown>), bible };
    await prisma.story.update({ where: { id: d.storyId }, data: { state: newState as object } });
    await setJob(d.jobId, { status: 'done', progress: 100, resultUrl: item.refUrl });
    return { url: item.refUrl };
  } catch (e) {
    await setJob(d.jobId, { status: 'failed', error: String(e).slice(0, 300) });
    throw e;
  }
}

const bookWorker = new Worker(
  'page',
  async (job) => {
    if (job.name === 'regen') {
      return regenerateScene(job.data as { jobId: string; storyId: string; sceneId: string });
    }
    if (job.name === 'costume') {
      return regenerateCostume(job.data as { jobId: string; storyId: string; name: string; outfit?: string });
    }
    const d = job.data as { jobId: string; storyId: string };
    await ensureStorage();
    await setJob(d.jobId, { status: 'running', progress: 5 });
    try {
      const story = await prisma.story.findUnique({
        where: { id: d.storyId },
        include: { scenes: { orderBy: { no: 'asc' } } },
      });
      if (!story) throw new Error('story not found');
      const state = story.state as {
        characters?: { name?: string; sheetUrl?: string | null; lockedDesc?: string | null }[];
        style_anchor?: string;
      };
      const bible = await ensureBible(d.storyId);

      const chars = combinedChars(state.characters, bible);
      const allRefs = await loadCharRefs(chars);
      const costume = await loadCostumeMap(bible);
      const scenes = story.scenes;
      const prompts = await generateScenePrompts(
        SCENE_PROMPTS_SYSTEM,
        promptStateForScenes(
          bible,
          chars,
          state.style_anchor,
          scenes.map((s) => ({ no: s.no, title: s.title, beat: s.beat, text: s.text }))
        )
      );

      const CONCURRENCY = 3;
      let completed = 0;
      let failedCount = 0;
      const queue = [...scenes];
      async function runOne(sc: (typeof scenes)[number]) {
        const cast = castForScene(allRefs, bible, sc);
        const refs = sceneRefsByOutfit(cast, bible, sc.no, costume);
        const base = prompts[sc.no] || `${sc.title} ${sc.beat}`;
        const p = base + REF_NOTE + castClause(cast) + continuityClause(bible, sc.no, cast) + STYLE_DIR + NOTEXT;
        try {
          const b64 = await genImageFromRefs(p, refs, '1536x1024', env.bookQuality);
          const url = await saveImageB64(b64);
          await prisma.scene.update({ where: { id: sc.id }, data: { imageUrl: url, prompt: prompts[sc.no] ?? null } });
        } catch (err) {
          failedCount++;
          console.error(`[book] scene ${sc.no} failed`, err);
        } finally {
          completed++;
          await setJob(d.jobId, { progress: Math.round((completed / scenes.length) * 100) });
        }
      }
      async function runner() {
        while (queue.length) {
          const sc = queue.shift();
          if (!sc) break;
          await runOne(sc);
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, scenes.length) }, () => runner()));
      if (failedCount > 0) console.warn(`[book] ${failedCount} page(s) failed`);

      await prisma.story.update({ where: { id: d.storyId }, data: { status: 'done' } });
      await setJob(d.jobId, { status: 'done', progress: 100 });
      return { ok: true };
    } catch (e) {
      await setJob(d.jobId, { status: 'failed', error: String(e).slice(0, 300) });
      throw e;
    }
  },
  WORKER_OPTS
);
bookWorker.on('completed', (job) => console.log(`[book] done ${job.id}`));
bookWorker.on('failed', (job, err) => console.error(`[book] failed ${job?.id}`, err));

console.log('workers started: character, storyboard, book');
