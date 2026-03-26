import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as agentsDb from '../../db/api/agents.js';
import { ApiError, parseBody } from '../../lib/errors.js';

const createAgentSchema = z.object({
  name: z.string(),
  device: z.string().optional(),
  ip: z.string().optional(),
});

const updateAgentSchema = z.object({
  name: z.string().optional(),
  device: z.string().optional(),
  ip: z.string().optional(),
});

const reportSchema = z.object({
  type: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const agentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: fastify.authenticate }, async () => {
    return agentsDb.listAgents();
  });

  fastify.post('/', { preHandler: [fastify.authenticate, fastify.enforceIdempotency] }, async (request, reply) => {
    const body = parseBody(createAgentSchema, request.body);

    const rawKey = crypto.randomBytes(32).toString('hex');
    const apiKeyHash = await bcrypt.hash(rawKey, 10);

    const agent = await agentsDb.createAgent({ ...body, apiKeyHash });
    const response = { ...agent, apiKey: rawKey };
    await fastify.finalizeIdempotency(request, 201, response);
    return reply.code(201).send(response);
  });

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = await agentsDb.getAgent(id);
    if (!agent) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    return agent;
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateAgentSchema, request.body);
    const agent = await agentsDb.updateAgent(id, body);
    if (!agent) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    return agent;
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await agentsDb.deleteAgent(id);
    return reply.code(204).send();
  });

  fastify.get('/:id/activity', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(Number(query.limit ?? 50), 200);
    const offset = Number(query.offset ?? 0);
    const data = await agentsDb.getActivities(id, limit, offset);
    return { data, limit, offset };
  });

  fastify.post('/report', { preHandler: [fastify.authenticateAgent, fastify.enforceIdempotency] }, async (request, reply) => {
    const agent = (request as FastifyRequest & { agent: { id: string } }).agent;
    const body = parseBody(reportSchema, request.body);

    await agentsDb.updateAgent(agent.id, { lastSeen: new Date(), status: 'online' });
    const activity = await agentsDb.insertActivity({ agentId: agent.id, ...body });
    await fastify.finalizeIdempotency(request, 201, activity);
    return reply.code(201).send(activity);
  });
};

export default agentRoutes;
