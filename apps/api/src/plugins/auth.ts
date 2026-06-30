import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../env';

// @fastify/jwt 등록 + app.authenticate preHandler 데코레이터
export default fp(async (app) => {
  app.register(jwt, { secret: env.jwtSecret });

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'unauthorized' });
    }
  });
});
