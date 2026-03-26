import type { FastifyPluginAsync, FastifyReply } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  const deprecated = async (_request: unknown, reply: FastifyReply) =>
    reply.code(410).send({
      error:
        'Legacy health goals and entries are deprecated. Use /api/health/analysis with goal text and Daily Log data in AI Insights.',
    });

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
