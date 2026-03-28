import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as agentsDb from '../../db/api/agents.js';
import * as settingsDb from '../../db/api/settings.js';
import { backendRequestSchemas } from '../../contracts/mcp-contract.js';
import { ApiError, parseBody } from '../../lib/errors.js';

const updateAgentSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  device: z.string().optional(),
  ip: z.string().optional(),
  orgRole: z.enum(['chief_of_staff', 'member']).optional(),
  specialization: z.string().optional(),
  description: z.string().optional(),
  reportsToAgentId: z.string().uuid().nullable().optional(),
});

const reportSchema = z.object({
  type: z.string(),
  status: z.enum(['online', 'idle', 'offline']).optional(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const agentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: fastify.authenticate }, async () => {
    return agentsDb.listAgents();
  });

  fastify.post('/', { preHandler: [fastify.authenticate, fastify.enforceIdempotency] }, async (request, reply) => {
    const body = parseBody(backendRequestSchemas.createAgent, request.body);

    const rawKey = crypto.randomBytes(32).toString('hex');
    const apiKeyHash = await bcrypt.hash(rawKey, 10);

    // Auto-assign CoS role: first agent becomes Chief of Staff
    const existingCoS = await agentsDb.getCoSAgents();
    const orgRole = existingCoS.length === 0 ? 'chief_of_staff' : 'member';

    const agent = await agentsDb.createAgent({ ...body, apiKeyHash, orgRole });

    const instrKey = orgRole === 'chief_of_staff' ? 'cos_instructions' : 'agent_instructions';
    const instructions = await settingsDb.getSetting(instrKey);

    const response = { ...agent, apiKey: rawKey, instructions };
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
    const agent = (request as FastifyRequest & { agent: { id: string; orgRole: string } }).agent;
    const body = parseBody(reportSchema, request.body);

    await agentsDb.updateAgent(agent.id, {
      lastSeen: new Date(),
      status: body.status ?? inferStatusFromType(body.type),
    });
    const activity = await agentsDb.insertActivity({ agentId: agent.id, ...body });

    const instrKey = agent.orgRole === 'chief_of_staff' ? 'cos_instructions' : 'agent_instructions';
    const instructions = await settingsDb.getSetting(instrKey);

    const response = { ...activity, instructions };
    await fastify.finalizeIdempotency(request, 201, response);
    return reply.code(201).send(response);
  });
};

function inferStatusFromType(type: string): 'online' | 'idle' | 'offline' {
  const normalized = type.toLowerCase();
  if (normalized.includes('offline')) return 'offline';
  if (normalized.includes('idle') || normalized.includes('waiting')) return 'idle';
  return 'online';
}

export default agentRoutes;
