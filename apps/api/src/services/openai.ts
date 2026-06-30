import OpenAI, { toFile } from 'openai';
import { env } from '../env';

const client = new OpenAI({ apiKey: env.openaiKey });

const DEFAULT_SIZE = '1536x1024';

type Quality = 'low' | 'medium' | 'high' | 'auto';

// 데이터 URL(data:image/...;base64,) 접두사를 떼고 MIME에 맞춰 파일로 변환.
// 업로드 사진(data URL)·raw base64 모두 안전하게 처리.
async function toImageFile(input: string, idx = 0) {
  let data = input;
  let mime = 'image/png';
  let ext = 'png';
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]*)$/.exec(input);
  if (m) {
    mime = m[1];
    data = m[2];
    const sub = mime.split('/')[1] || 'png';
    ext = sub === 'jpeg' ? 'jpg' : sub;
  }
  let buf = Buffer.from(data, 'base64');
  // 아이폰 HEIC/HEIF → JPEG 서버 변환 (OpenAI는 HEIC 미지원)
  const isFtyp = buf.subarray(4, 8).toString('ascii') === 'ftyp';
  const brand = buf.subarray(8, 12).toString('ascii').toLowerCase();
  if (isFtyp && /heic|heix|hevc|hevx|mif1|msf1|heim|heis|hevm|hevs/.test(brand)) {
    try {
      const heicConvert = (await import('heic-convert')).default as unknown as (o: { buffer: Buffer; format: 'JPEG' | 'PNG'; quality?: number }) => Promise<ArrayBuffer>;
      buf = Buffer.from(await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.92 }));
      mime = 'image/jpeg';
      ext = 'jpg';
      console.log('[img] HEIC→JPEG converted, bytes=%d', buf.length);
    } catch (e) {
      throw new Error('HEIC 사진 변환에 실패했어요. JPG/PNG 사진으로 올려주세요.');
    }
  }
  const sig = buf.subarray(0, 4).toString('hex');
  const known = sig.startsWith('89504e47') || sig.startsWith('ffd8ff') || sig.startsWith('52494646');
  if (!known) console.warn('[img] still-unsupported sig=%s bytes=%d', sig, buf.length);
  else console.log('[img] ok mime=%s bytes=%d', mime, buf.length);
  return toFile(buf, `ref${idx}.${ext}`, { type: mime });
}

export async function genImageFromPrompt(prompt: string, size = DEFAULT_SIZE, quality?: Quality): Promise<string> {
  const r = await client.images.generate({
    model: env.imageModel,
    prompt,
    size: size as never,
    n: 1,
    ...(quality ? { quality: quality as never } : {}),
  });
  const b64 = r.data?.[0]?.b64_json;
  if (!b64) throw new Error('no image returned');
  return b64;
}

export async function genImageFromRef(prompt: string, refB64: string, size = DEFAULT_SIZE, quality?: Quality): Promise<string> {
  const image = await toImageFile(refB64);
  const r = await client.images.edit({
    model: env.imageModel,
    image,
    prompt,
    size: size as never,
    ...(quality ? { quality: quality as never } : {}),
  });
  const b64 = r.data?.[0]?.b64_json;
  if (!b64) throw new Error('no image returned');
  return b64;
}

// 여러 캐릭터 시트를 동시에 레퍼런스로 (gpt-image-2 다중 입력)
export async function genImageFromRefs(prompt: string, refsB64: string[], size = DEFAULT_SIZE, quality?: Quality): Promise<string> {
  if (refsB64.length === 0) return genImageFromPrompt(prompt, size, quality);
  if (refsB64.length === 1) return genImageFromRef(prompt, refsB64[0], size, quality);
  const images = await Promise.all(
    refsB64.map((b, i) => toImageFile(b, i))
  );
  const r = await client.images.edit({
    model: env.imageModel,
    image: images as never,
    prompt,
    size: size as never,
    ...(quality ? { quality: quality as never } : {}),
  });
  const b64 = r.data?.[0]?.b64_json;
  if (!b64) throw new Error('no image returned');
  return b64;
}

export async function describeCharacter(b64: string): Promise<string> {
  const r = await client.chat.completions.create({
    model: env.textModel,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Describe ONLY the fixed visual look of the main character in this character sheet in one concise English sentence so it can be reproduced identically in every scene. Include: hair, skin tone, eyes, age vibe, and ESPECIALLY the default OUTFIT — name each clothing item, its colors and any accessories precisely (for an animal/creature: species, colors, key features instead). No background, no scene.',
          },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
        ],
      },
    ],
  });
  return r.choices[0]?.message?.content?.trim() ?? '';
}

// 범용 채팅 (기획 대화)
export async function chat(messages: { role: 'system' | 'user' | 'assistant'; content: string }[]): Promise<string> {
  const r = await client.chat.completions.create({ model: env.textModel, messages, temperature: 0.8 });
  return r.choices[0]?.message?.content ?? '';
}

async function sceneMap(system: string, state: unknown, field: 'text' | 'image_prompt'): Promise<Record<number, string>> {
  const r = await client.chat.completions.create({
    model: env.textModel,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(state) },
    ],
  });
  const content = r.choices[0]?.message?.content ?? '{}';
  const m = content.match(/```json\s*([\s\S]*?)```/i);
  const json = JSON.parse(m ? m[1].trim() : content.trim());
  const map: Record<number, string> = {};
  (json.scenes || []).forEach((s: Record<string, unknown>) => {
    map[s.no as number] = (s[field] as string) ?? '';
  });
  return map;
}

export const generateSceneTexts = (system: string, state: unknown) => sceneMap(system, state, 'text');
export const generateScenePrompts = (system: string, state: unknown) => sceneMap(system, state, 'image_prompt');

// 초안을 한 번 더 검토·보강 (편집 패스)
export async function refineSceneTexts(
  system: string,
  state: unknown,
  draft: Record<number, string>
): Promise<Record<number, string>> {
  const r = await client.chat.completions.create({
    model: env.textModel,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify({ plan: state, draft }) },
    ],
  });
  const content = r.choices[0]?.message?.content ?? '{}';
  const m = content.match(/```json\s*([\s\S]*?)```/i);
  const json = JSON.parse(m ? m[1].trim() : content.trim());
  const map: Record<number, string> = {};
  (json.scenes || []).forEach((s: Record<string, unknown>) => {
    map[s.no as number] = (s.text as string) ?? '';
  });
  return map;
}

// 스토리 바이블(연출 스펙) 생성: 그림 전, 공통 시각요소를 한 번 확정
export async function generateStoryBible(system: string, state: unknown): Promise<Record<string, unknown>> {
  const r = await client.chat.completions.create({
    model: env.textModel,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(state) },
    ],
  });
  const content = r.choices[0]?.message?.content ?? '{}';
  const m = content.match(/```json\s*([\s\S]*?)```/i);
  return JSON.parse(m ? m[1].trim() : content.trim());
}
