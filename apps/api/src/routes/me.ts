import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/client';

export async function meRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      credits: user.credits,
      plan: user.plan,
    };
  });
}
