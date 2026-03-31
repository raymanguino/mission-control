import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as channelsDb from '../../db/api/channels.js';
import { parseBody } from '../../lib/errors.js';

const createChannelSchema = z.object({
  name: z.string(),
  source: z.enum(['discord', 'manual']).optional(),
  externalId: z.string().optional(),
});

const channelRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: fastify.authenticate }, async () => {
    return channelsDb.listChannels();
  });

  fastify.post('/', { preHandler: [fastify.authenticate, fastify.enforceIdempotency] }, async (request, reply) => {
    const body = parseBody(createChannelSchema, request.body);
    const channel = await channelsDb.createChannel(body);
    await fastify.finalizeIdempotency(request, 201, channel);
    return reply.code(201).send(channel);
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await channelsDb.deleteChannel(id);
    return reply.code(204).send();
  });

  fastify.get('/:id/messages', { preHandler: fastify.authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    const q = request.query as { limit?: string; before?: string };
    const limit = Math.min(Number(q.limit ?? 50), 200);
    const rows = await channelsDb.listMessages(id, limit, q.before);
    return rows;
  });
};

export default channelRoutes;
