import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { getIdempotencyMetrics } from '../../services/idempotency-metrics.js';
import { sendError } from '../../lib/errors.js';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/idempotency-metrics', { preHandler: fastify.authenticate }, async () => {
    return getIdempotencyMetrics();
  });

  const deprecated = async (_request: unknown, reply: FastifyReply) =>
    sendError(
      reply,
      410,
      'BAD_REQUEST',
      'Legacy health goals and entries are deprecated. Use /api/health/analysis with goal text and Daily Log data in AI Insights.',
    );

  fastify.get('/goals', { preHandler: fastify.authenticate }, deprecated);
  fastify.post('/goals', { preHandler: fastify.authenticate }, deprecated);
  fastify.patch('/goals/:id', { preHandler: fastify.authenticate }, deprecated);
  fastify.delete('/goals/:id', { preHandler: fastify.authenticate }, deprecated);
  fastify.get('/entries', { preHandler: fastify.authenticate }, deprecated);
  fastify.post('/entries', { preHandler: fastify.authenticate }, deprecated);
  fastify.patch('/entries/:id', { preHandler: fastify.authenticate }, deprecated);
  fastify.delete('/entries/:id', { preHandler: fastify.authenticate }, deprecated);
};

export default healthRoutes;
