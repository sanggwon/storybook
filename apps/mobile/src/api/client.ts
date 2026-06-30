import type {
  HealthResponse,
  AuthResponse,
  UserPublic,
  CharacterRecord,
  JobRecord,
  StoryRecord,
  StoryStateLoose,
} from '@storybook/shared';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

let authToken: string | null = null;
export function setAuthToken(t: string | null) {
  authToken = t;
}

function buildHeaders(hasBody: boolean, extra?: Record<string, string>) {
  const h: Record<string, string> = { ...(extra ?? {}) };
  if (hasBody) h['Content-Type'] = 'application/json';
  h['ngrok-skip-browser-warning'] = 'true'; // ngrok 무료 경고 페이지 우회
  if (authToken) h.Authorization = `Bearer ${authToken}`;
  return h;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = !!(init && init.body != null);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: buildHeaders(hasBody, init?.headers as Record<string, string>),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

// 이미지 소스: 상대(/files/..)·옛 절대(localhost/files/..) 모두 현재 API 베이스로 정규화 + ngrok 우회
export function imageSource(u?: string | null): { uri: string; headers: Record<string, string> } | undefined {
  if (!u) return undefined;
  const i = u.indexOf('/files/');
  const pathPart = i >= 0 ? u.slice(i) : u;
  const uri = pathPart.startsWith('http') ? pathPart : `${BASE}${pathPart}`;
  return { uri, headers: { 'ngrok-skip-browser-warning': 'true' } };
}

// 이미지를 미리 받아 base64 data URL로 변환 (WebView 책자 뷰어에 즉시 표시 + 자연스러운 넘김용)
export async function imageDataUrl(u?: string | null): Promise<string | undefined> {
  const src = imageSource(u);
  if (!src) return undefined;
  try {
    const res = await fetch(src.uri, { headers: src.headers });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('read failed'));
      fr.onload = () => resolve(fr.result as string);
      fr.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

export const api = {
  baseUrl: BASE,
  health: () => request<HealthResponse>('/health'),
  register: (email: string, password: string, name?: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<UserPublic>('/me'),

  listCharacters: () => request<CharacterRecord[]>('/characters'),
  createCharacter: (payload: {
    name?: string;
    role?: string;
    age?: number;
    personality?: string;
    style?: string;
    photoBase64?: string;
  }) => request<{ jobId: string; characterId: string }>('/characters', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  reviseCharacter: (id: string, feedback: string) =>
    request<{ jobId: string; characterId: string }>(`/characters/${id}/revise`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    }),
  deleteCharacter: (id: string) =>
    request<{ ok: boolean }>(`/characters/${id}`, { method: 'DELETE' }),

  getJob: (id: string) => request<JobRecord>(`/jobs/${id}`),

  planChat: (messages: { role: 'user' | 'assistant'; content: string }[], characterIds: string[]) =>
    request<{ reply: string }>('/plan/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, characterIds }),
    }),
  createStory: (title: string, state: StoryStateLoose) =>
    request<{ storyId: string }>('/stories', { method: 'POST', body: JSON.stringify({ title, state }) }),
  startStoryboard: (storyId: string) =>
    request<{ jobId: string }>(`/stories/${storyId}/storyboard`, { method: 'POST' }),
  startBook: (storyId: string) => request<{ jobId: string }>(`/stories/${storyId}/book`, { method: 'POST' }),
  getStory: (storyId: string) => request<StoryRecord>(`/stories/${storyId}`),
  listStories: () => request<StoryRecord[]>('/stories'),
  regenScene: (storyId: string, sceneId: string) =>
    request<{ jobId: string }>(`/stories/${storyId}/scenes/${sceneId}/regenerate`, { method: 'POST' }),
  regenerateCostume: (storyId: string, name: string, outfit?: string) =>
    request<{ jobId: string }>(`/stories/${storyId}/wardrobe/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ name, outfit }),
    }),
};
