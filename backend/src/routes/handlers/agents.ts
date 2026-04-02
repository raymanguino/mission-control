import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AGENT_AVATAR_IDS } from '../../lib/agentAvatarIds.js';
import * as agentsDb from '../../db/api/agents.js';
import * as settingsDb from '../../db/api/settings.js';
import { backendRequestSchemas } from '../../contracts/mcp-contract.js';
import { ApiError, parseBody } from '../../lib/errors.js';
import { touchMcpActivity } from '../../lib/mcpActivity.js';
import { toPublicAgent } from '../../lib/publicAgent.js';

const agentAvatarIdSchema = z
  .enum(AGENT_AVATAR_IDS as unknown as [string, ...string[]])
  .nullable()
  .optional();

const updateAgentSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  device: z.string().optional(),
  ip: z.string().optional(),
  orgRole: z.enum(['chief_of_staff', 'member']).optional(),
  specialization: z.string().optional(),
  description: z.string().optional(),
  reportsToAgentId: z.string().uuid().nullable().optional(),
  avatarId: agentAvatarIdSchema,
  hookUrl: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),
  hookToken: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(1).optional(),
  ),
});

const reportSchema = z.object({
  type: z.string(),
  status: z.enum(['online', 'idle', 'offline']).optional(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const agentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: fastify.authenticate }, async () => {
    const rows = await agentsDb.listAgents();
    return rows.map(toPublicAgent);
  });

  fastify.post('/', { preHandler: [fastify.authenticate, fastify.enforceIdempotency] }, async (request, reply) => {
    const body = parseBody(backendRequestSchemas.createAgent, request.body);

    if (body.reportsToAgentId) {
      const manager = await agentsDb.getAgent(body.reportsToAgentId);
      if (!manager) {
        throw new ApiError(
          400,
          'VALIDATION_FAILED',
          'reportsToAgentId must reference an existing agent',
        );
      }
    }

    const rawKey = crypto.randomBytes(32).toString('hex');
    const apiKeyHash = await bcrypt.hash(rawKey, 10);

    // Auto-assign CoS role: first agent becomes Chief of Staff
    const existingCoS = await agentsDb.getCoSAgents();
    const orgRole = existingCoS.length === 0 ? 'chief_of_staff' : 'member';

    const agent = await agentsDb.createAgent({ ...body, apiKeyHash, orgRole });
    await touchMcpActivity([agent.id]);

    const instrKey = orgRole === 'chief_of_staff' ? 'cos_instructions' : 'agent_instructions';
    const agentInstructions = await settingsDb.getSetting(instrKey);

    const response = { ...toPublicAgent(agent), apiKey: rawKey, agentInstructions };
    await fastify.finalizeIdempotency(request, 201, response);
    return reply.code(201).send(response);
  });

  fastify.get('/fleet-activity', { preHandler: fastify.authenticate }, async (request) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(Number(query.limit ?? 50), 200);
    const offset = Number(query.offset ?? 0);
    const data = await agentsDb.listFleetActivities(limit, offset);
    return { data, limit, offset };
  });

  fastify.get('/instructions', { preHandler: fastify.authenticateAgent }, async (request) => {
    const agent = (request as FastifyRequest & { agent: { id: string; orgRole: string } }).agent;
    await touchMcpActivity([agent.id]);
    const key = instructionKeyForOrgRole(agent.orgRole);
    const row = await settingsDb.getSettingRow(key);
    if (!row) {
      return { instructions: null as string | null, updatedAt: null as string | null };
    }
    return {
      instructions: row.value,
      updatedAt: row.updatedAt.toISOString(),
    };
  });

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    const agent = await agentsDb.getAgent(id);
    if (!agent) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    await touchMcpActivity([id]);
    return toPublicAgent(agent);
  });

  fastify.get('/:id/instructions', { preHandler: fastify.authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    const agent = await agentsDb.getAgent(id);
    if (!agent) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    await touchMcpActivity([id]);
    const orgRole = agent.orgRole as 'chief_of_staff' | 'member';
    const key = instructionKeyForOrgRole(orgRole);
    const instructions = (await settingsDb.getSetting(key)) ?? '';
    return {
      agentId: agent.id,
      orgRole,
      instructions,
    };
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await agentsDb.getAgent(id);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Not found');

    const body = parseBody(updateAgentSchema, request.body);
    if (body.reportsToAgentId !== undefined && body.reportsToAgentId !== null) {
      const manager = await agentsDb.getAgent(body.reportsToAgentId);
      if (!manager) {
        throw new ApiError(
          400,
          'VALIDATION_FAILED',
          'reportsToAgentId must reference an existing agent',
        );
      }
    }

    const mergedUrl = body.hookUrl !== undefined ? body.hookUrl : existing.hookUrl;
    const mergedToken = body.hookToken !== undefined ? body.hookToken : existing.hookToken;
    if (!mergedUrl?.trim() || !mergedToken?.trim()) {
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Agent must have a webhook URL and hook token. Include hookUrl and hookToken (or omit one field to keep the stored value).',
      );
    }

    const agent = await agentsDb.updateAgent(id, body);
    if (!agent) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    await touchMcpActivity([id]);
    return toPublicAgent(agent);
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await touchMcpActivity([id]);
    await agentsDb.deleteAgent(id);
    return reply.code(204).send();
  });

  fastify.get('/:id/activity', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(Number(query.limit ?? 50), 200);
    const offset = Number(query.offset ?? 0);
    const data = await agentsDb.getActivities(id, limit, offset);
    await touchMcpActivity([id]);
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
    await touchMcpActivity([agent.id]);

    const instrKey = instructionKeyForOrgRole(agent.orgRole);
    const instrRow = await settingsDb.getSettingRow(instrKey);

    const response = {
      ...activity,
      ...(instrRow ? { instructionsUpdatedAt: instrRow.updatedAt.toISOString() } : {}),
    };
    await fastify.finalizeIdempotency(request, 201, response);
    return reply.code(201).send(response);
  });
};

function instructionKeyForOrgRole(orgRole: string): 'cos_instructions' | 'agent_instructions' {
  return orgRole === 'chief_of_staff' ? 'cos_instructions' : 'agent_instructions';
}

function inferStatusFromType(type: string): 'online' | 'idle' | 'offline' {
  const normalized = type.toLowerCase();
  if (normalized.includes('offline')) return 'offline';
  if (normalized.includes('idle') || normalized.includes('waiting')) return 'idle';
  return 'online';
}

export default agentRoutes;
