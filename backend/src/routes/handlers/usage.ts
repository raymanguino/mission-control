import type { FastifyPluginAsync } from 'fastify';
import * as usageDb from '../../db/api/usage.js';
import { syncOpenRouterUsage } from '../../services/openrouter.js';
import { getAiRoutingDiagnostics } from '../../services/ai/diagnostics.js';

const usageRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: fastify.authenticate }, async (request) => {
    const q = request.query as { from?: string; to?: string; groupBy?: string };
    const groupBy =
      q.groupBy === 'model' || q.groupBy === 'apiKey' || q.groupBy === 'agent'
        ? q.groupBy
        : 'model';
    return usageDb.getAggregated({ from: q.from, to: q.to, groupBy });
  });

  fastify.get('/records', { preHandler: fastify.authenticate }, async (request) => {
    const q = request.query as { limit?: string; offset?: string; from?: string; to?: string };
    const limit = Math.min(Number(q.limit ?? 50), 200);
    const offset = Number(q.offset ?? 0);
    return usageDb.listRecords(limit, offset, { from: q.from, to: q.to });
  });

  fastify.get('/ai/config', { preHandler: fastify.authenticate }, async () => {
    return getAiRoutingDiagnostics();
  });

  fastify.post('/sync', { preHandler: fastify.authenticate }, async (_request, reply) => {
    try {
      const count = await syncOpenRouterUsage();
      return { synced: count };
    } catch (err) {
      fastify.log.error(err);
      const message = err instanceof Error ? err.message : 'Sync failed';
      return reply.code(500).send({ error: message });
    }
  });
};

export default usageRoutes;
