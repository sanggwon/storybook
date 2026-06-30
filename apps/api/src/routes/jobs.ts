import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/client';

export async function jobRoutes(app: FastifyInstance) {
  app.get('/jobs/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await prisma.job.findFirst({ where: { id, userId: req.user.sub } });
    if (!job) return reply.code(404).send({ error: 'not_found' });
    return job;
  });
}
