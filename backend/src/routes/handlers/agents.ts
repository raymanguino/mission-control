import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as agentsDb from '../../db/api/agents.js';

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

  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = createAgentSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' });

    const rawKey = crypto.randomBytes(32).toString('hex');
    const apiKeyHash = await bcrypt.hash(rawKey, 10);

    const agent = await agentsDb.createAgent({ ...body.data, apiKeyHash });
    return reply.code(201).send({ ...agent, apiKey: rawKey });
  });

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = await agentsDb.getAgent(id);
    if (!agent) return reply.code(404).send({ error: 'Not found' });
    return agent;
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateAgentSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' });
    const agent = await agentsDb.updateAgent(id, body.data);
    if (!agent) return reply.code(404).send({ error: 'Not found' });
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

  fastify.post('/report', { preHandler: fastify.authenticateAgent }, async (request, reply) => {
    const agent = (request as FastifyRequest & { agent: { id: string } }).agent;
    const body = reportSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' });

    await agentsDb.updateAgent(agent.id, { lastSeen: new Date(), status: 'online' });
    const activity = await agentsDb.insertActivity({ agentId: agent.id, ...body.data });
    return reply.code(201).send(activity);
  });
};

export default agentRoutes;
