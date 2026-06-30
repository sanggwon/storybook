import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client';
import { characterQueue } from '../queue/queues';

const DEFAULT_STYLE = "warm whimsical fantasy children's book illustration, soft glowing light, gentle pastel palette, hand-drawn picture-book look";

const createSchema = z.object({
  name: z.string().optional(),
  role: z.string().default('주인공'),
  age: z.number().int().optional(),
  personality: z.string().optional(),
  style: z.string().default(DEFAULT_STYLE),
  photoBase64: z.string().optional(),
});

function stripDataUrl(s?: string) {
  if (!s) return undefined;
  const i = s.indexOf('base64,');
  return i >= 0 ? s.slice(i + 'base64,'.length) : s;
}

export async function characterRoutes(app: FastifyInstance) {
  app.get('/characters', { preHandler: [app.authenticate] }, async (req) =>
    prisma.character.findMany({ where: { userId: req.user.sub }, orderBy: { createdAt: 'asc' } })
  );

  app.post('/characters', { preHandler: [app.authenticate] }, async (req) => {
    const body = createSchema.parse(req.body);
    const character = await prisma.character.create({
      data: {
        userId: req.user.sub,
        name: body.name || '캐릭터',
        role: body.role,
        age: body.age,
        personality: body.personality,
        status: 'pending',
      },
    });
    const job = await prisma.job.create({
      data: { userId: req.user.sub, type: 'character', refId: character.id, status: 'queued' },
    });
    await characterQueue.add('generate', {
      jobId: job.id,
      characterId: character.id,
      name: body.name,
      role: body.role,
      age: body.age,
      personality: body.personality,
      style: body.style,
      photoBase64: stripDataUrl(body.photoBase64),
    });
    return { jobId: job.id, characterId: character.id };
  });

  app.post('/characters/:id/revise', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ feedback: z.string().min(1), style: z.string().optional() }).parse(req.body);
    const character = await prisma.character.findFirst({ where: { id, userId: req.user.sub } });
    if (!character) return reply.code(404).send({ error: 'not_found' });

    await prisma.character.update({ where: { id }, data: { status: 'pending' } });
    const job = await prisma.job.create({
      data: { userId: req.user.sub, type: 'character', refId: id, status: 'queued' },
    });
    await characterQueue.add('revise', {
      jobId: job.id,
      characterId: id,
      revise: true,
      feedback: body.feedback,
      style: body.style ?? DEFAULT_STYLE,
    });
    return { jobId: job.id, characterId: id };
  });

  app.delete('/characters/:id', { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    await prisma.character.deleteMany({ where: { id, userId: req.user.sub } });
    return { ok: true };
  });
}
