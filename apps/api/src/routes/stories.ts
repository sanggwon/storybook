import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client';
import { storyboardQueue, pageQueue } from '../queue/queues';

const sceneSchema = z.object({ no: z.number(), title: z.string().default(''), beat: z.string().default('') });
const stateSchema = z.object({
  topic: z.string().default('동화'),
  style: z.string().optional(),
  scene_count: z.number().optional(),
  style_anchor: z.string().optional(),
  characters: z.array(z.any()).default([]),
  scenes: z.array(sceneSchema).default([]),
});

export async function storyRoutes(app: FastifyInstance) {
  app.post('/stories', { preHandler: [app.authenticate] }, async (req) => {
    const body = z.object({ title: z.string().optional(), state: stateSchema }).parse(req.body);
    const state = body.state;
    const story = await prisma.story.create({
      data: {
        userId: req.user.sub,
        title: body.title || state.topic,
        state: state as object,
        status: 'draft',
        scenes: {
          create: state.scenes.map((s) => ({ no: s.no, title: s.title, beat: s.beat })),
        },
      },
    });
    return { storyId: story.id };
  });

  app.post('/stories/:id/storyboard', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const story = await prisma.story.findFirst({ where: { id, userId: req.user.sub } });
    if (!story) return reply.code(404).send({ error: 'not_found' });
    const job = await prisma.job.create({
      data: { userId: req.user.sub, type: 'storyboard', refId: id, status: 'queued' },
    });
    await storyboardQueue.add('generate', { jobId: job.id, storyId: id });
    return { jobId: job.id };
  });

  app.get('/stories', { preHandler: [app.authenticate] }, async (req) =>
    prisma.story.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'desc' },
      include: { scenes: { orderBy: { no: 'asc' } } },
    })
  );

  app.post('/stories/:id/book', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const story = await prisma.story.findFirst({ where: { id, userId: req.user.sub } });
    if (!story) return reply.code(404).send({ error: 'not_found' });
    const job = await prisma.job.create({
      data: { userId: req.user.sub, type: 'book', refId: id, status: 'queued' },
    });
    await pageQueue.add('book', { jobId: job.id, storyId: id });
    return { jobId: job.id };
  });

  app.post('/stories/:id/scenes/:sceneId/regenerate', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id, sceneId } = req.params as { id: string; sceneId: string };
    const story = await prisma.story.findFirst({ where: { id, userId: req.user.sub } });
    if (!story) return reply.code(404).send({ error: 'not_found' });
    const job = await prisma.job.create({ data: { userId: req.user.sub, type: 'page', refId: sceneId, status: 'queued' } });
    await pageQueue.add('regen', { jobId: job.id, storyId: id, sceneId });
    return { jobId: job.id };
  });

  // 의상 레퍼런스 다시 뽑기 / 수정
  app.post('/stories/:id/wardrobe/regenerate', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ name: z.string(), outfit: z.string().optional() }).parse(req.body);
    const story = await prisma.story.findFirst({ where: { id, userId: req.user.sub } });
    if (!story) return reply.code(404).send({ error: 'not_found' });
    const job = await prisma.job.create({ data: { userId: req.user.sub, type: 'page', refId: id, status: 'queued' } });
    await pageQueue.add('costume', { jobId: job.id, storyId: id, name: body.name, outfit: body.outfit });
    return { jobId: job.id };
  });

  app.get('/stories/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const story = await prisma.story.findFirst({
      where: { id, userId: req.user.sub },
      include: { scenes: { orderBy: { no: 'asc' } } },
    });
    if (!story) return reply.code(404).send({ error: 'not_found' });
    return story;
  });
}
