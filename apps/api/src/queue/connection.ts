import { Redis } from 'ioredis';
import { env } from '../env';

// BullMQ는 maxRetriesPerRequest: null 이 필요
export const connection = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null,
});
