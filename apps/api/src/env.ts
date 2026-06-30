import 'dotenv/config';
import path from 'path';

const port = Number(process.env.PORT ?? 4000);

export const env = {
  port,
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  openaiKey: process.env.OPENAI_API_KEY ?? '',
  textModel: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o',
  imageModel: process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${port}`,
  storageDir: process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.join(process.cwd(), 'storage'),
  bookQuality: (process.env.BOOK_IMAGE_QUALITY ?? 'low') as 'low' | 'medium' | 'high' | 'auto',
};
