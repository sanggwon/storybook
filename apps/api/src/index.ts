import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { env } from './env';
import { ensureStorage } from './services/storage';
import authPlugin from './plugins/auth';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { characterRoutes } from './routes/characters';
import { jobRoutes } from './routes/jobs';
import { planRoutes } from './routes/plan';
import { storyRoutes } from './routes/stories';

const app = Fastify({ logger: true, bodyLimit: 20 * 1024 * 1024 });

// 본문 없는 application/json POST 도 허용 (빈 본문 → {})
app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
  if (!body || (body as string).length === 0) return done(null, {});
  try {
    done(null, JSON.parse(body as string));
  } catch (err) {
    done(err as Error, undefined);
  }
});

await ensureStorage();

await app.register(cors, { origin: true });
await app.register(fastifyStatic, { root: env.storageDir, prefix: '/files/' });
await app.register(authPlugin);
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(meRoutes);
await app.register(characterRoutes);
await app.register(jobRoutes);
await app.register(planRoutes);
await app.register(storyRoutes);

app
  .listen({ port: env.port, host: '0.0.0.0' })
  .then(() => app.log.info(`API listening on :${env.port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
