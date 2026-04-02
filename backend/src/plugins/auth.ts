import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import type { InferSelectModel } from 'drizzle-orm';
import { listAgents } from '../db/api/agents.js';
import { agents } from '../db/schema.js';
import { sendError } from '../lib/errors.js';

export type AgentAuthRow = InferSelectModel<typeof agents>;

declare module 'fastify' {
  interface FastifyRequest {
    /** Set when `Authorization: Bearer` matches an agent API key (same secret used for MCP and report). */
    agent?: AgentAuthRow;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateAgent: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function resolveAgentFromBearer(request: FastifyRequest): Promise<AgentAuthRow | null> {
  const authorization = request.headers['authorization'];
  if (!authorization || typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    return null;
  }
  const rawKey = authorization.slice(7).trim();
  if (!rawKey) return null;

  const allAgents = await listAgents();
  for (const agent of allAgents) {
    const match = await bcrypt.compare(rawKey, agent.apiKeyHash);
    if (match) {
      return agent;
    }
  }
  return null;
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const authorization = request.headers['authorization'];
      if (!authorization || typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
        return sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
      }

      try {
        await request.jwtVerify();
        return;
      } catch {
        // Not a dashboard JWT — try agent API key (MCP, automation).
      }

      const agent = await resolveAgentFromBearer(request);
      if (agent) {
        request.agent = agent;
        return;
      }

      return sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
    },
  );

  fastify.decorate(
    'authenticateAgent',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const agent = await resolveAgentFromBearer(request);
      if (!agent) {
        return sendError(
          reply,
          401,
          'UNAUTHORIZED',
          'Missing or invalid Authorization: Bearer agent API key',
        );
      }
      request.agent = agent;
    },
  );
};

export default fp(authPlugin, { name: 'auth' });
