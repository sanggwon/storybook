import { Queue } from 'bullmq';
import { connection } from './connection';

// AI 생성 작업 큐 (STEP 2~5에서 사용)
// 실패 시 무한 재시도 소음 방지: 1회만 시도, 완료/실패 기록 정리
const opts = {
  connection,
  defaultJobOptions: { attempts: 1, removeOnComplete: true, removeOnFail: 100 },
};
export const characterQueue = new Queue('character', opts);
export const storyboardQueue = new Queue('storyboard', opts);
export const pageQueue = new Queue('page', opts);

export const queues = { characterQueue, storyboardQueue, pageQueue };
