import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../env';

// 로컬 디스크 스토리지 (추후 S3/R2로 교체 가능)
export async function ensureStorage() {
  await fs.mkdir(env.storageDir, { recursive: true });
}

export async function saveImageB64(b64: string, ext = 'png'): Promise<string> {
  await ensureStorage();
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  await fs.writeFile(path.join(env.storageDir, name), Buffer.from(b64, 'base64'));
  return `/files/${name}`; // 상대경로 — 앱이 자기 API 베이스로 붙여서 로드
}

export async function readImageB64FromUrl(url: string): Promise<string | null> {
  const marker = '/files/';
  const i = url.indexOf(marker);
  if (i < 0) return null;
  const name = url.slice(i + marker.length);
  try {
    const buf = await fs.readFile(path.join(env.storageDir, name));
    return buf.toString('base64');
  } catch {
    return null;
  }
}
