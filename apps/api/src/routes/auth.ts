import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db/client';

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

function publicUser(u: { id: string; email: string; name: string | null }) {
  return { id: u.id, email: u.email, name: u.name };
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (req, reply) => {
    const { email, password, name } = credentials.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return reply.code(409).send({ error: 'email_taken' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, passwordHash, name } });
    const token = app.jwt.sign({ sub: user.id });
    return { token, user: publicUser(user) };
  });

  app.post('/auth/login', async (req, reply) => {
    const { email, password } = credentials.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return reply.code(401).send({ error: 'invalid_credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return reply.code(401).send({ error: 'invalid_credentials' });

    const token = app.jwt.sign({ sub: user.id });
    return { token, user: publicUser(user) };
  });
}
