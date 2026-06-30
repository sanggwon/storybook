// 앱·API가 공유하는 도메인 타입

export type CharacterRole =
  | '주인공' | '친구' | '형제·자매' | '반려동물' | '가족' | '조력자' | '악당';

export interface Character {
  id: string;
  name: string;
  role: CharacterRole | string;
  /** 승인된 캐릭터 시트 이미지 URL */
  sheetUrl?: string;
  /** 일관성용 외모 고정 설명(영문) */
  lockedDesc?: string;
}

export interface Scene {
  no: number;
  title: string;
  /** 장면 비트(핵심 행동) */
  beat: string;
  /** 한국어 동화 글(대사 포함) */
  text?: string;
  /** 영어 이미지 프롬프트 */
  prompt?: string;
  /** 생성된 페이지 이미지 URL */
  imageUrl?: string;
}

/** 1단계 대화로 확정되는 구성 */
export interface StoryState {
  topic: string;
  style: string;
  audience?: string;
  aspectRatio?: string;
  sceneCount: number;
  characters: Character[];
  styleAnchor?: string;
  scenes: Scene[];
}

export type JobType = 'character' | 'storyboard' | 'page';
export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  /** 0~100 */
  progress: number;
  resultUrl?: string;
  error?: string;
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  time: string;
}

export interface UserPublic {
  id: string;
  email: string;
  name?: string | null;
  credits?: number;
  plan?: string;
}

export interface AuthResponse {
  token: string;
  user: UserPublic;
}

export interface CharacterRecord {
  id: string;
  name: string;
  role: string;
  personality?: string | null;
  sheetUrl?: string | null;
  lockedDesc?: string | null;
  status: string;
}

export interface JobRecord {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'done' | 'failed' | string;
  progress: number;
  resultUrl?: string | null;
  error?: string | null;
}

export interface SceneRecord {
  id: string;
  no: number;
  title: string;
  beat: string;
  text?: string | null;
  imageUrl?: string | null;
}

export interface StoryStateLoose {
  topic?: string;
  style?: string;
  style_anchor?: string;
  scene_count?: number;
  characters?: { id?: string; name?: string; role?: string; sheetUrl?: string | null; lockedDesc?: string | null }[];
  scenes?: { no: number; title?: string; beat?: string }[];
  [k: string]: unknown;
}

export interface StoryRecord {
  id: string;
  title: string;
  status: string;
  storyboardUrl?: string | null;
  state: StoryStateLoose;
  scenes: SceneRecord[];
}
