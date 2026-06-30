import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@storybook/shared';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (): Promise<HealthResponse> => ({
    status: 'ok',
    service: 'storybook-api',
    time: new Date().toISOString(),
  }));
}
