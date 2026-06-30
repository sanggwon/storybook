import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client';
import { chat } from '../services/openai';
import { plannerSystem } from '../services/prompts';

const schema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })),
  characterIds: z.array(z.string()).default([]),
});

// 대화형 기획: 클라이언트가 전체 히스토리를 보내고, 시스템 프롬프트는 서버가 캐릭터로 구성
export async function planRoutes(app: FastifyInstance) {
  app.post('/plan/chat', { preHandler: [app.authenticate] }, async (req) => {
    const { messages, characterIds } = schema.parse(req.body);
    const characters = await prisma.character.findMany({
      where: { id: { in: characterIds }, userId: req.user.sub },
    });
    const system = plannerSystem(
      characters.map((c) => ({ name: c.name, role: c.role, personality: c.personality }))
    );
    const reply = await chat([{ role: 'system', content: system }, ...messages]);
    return { reply };
  });
}
