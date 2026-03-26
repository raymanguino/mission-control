import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { listAgents } from '../db/api/agents.js';
import { sendError } from '../lib/errors.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateAgent: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        await request.jwtVerify();
      } catch {
        await sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
      }
    },
  );

  fastify.decorate(
    'authenticateAgent',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const rawKey = request.headers['x-agent-key'];
      if (!rawKey || typeof rawKey !== 'string') {
        await sendError(reply, 401, 'UNAUTHORIZED', 'Missing X-Agent-Key header');
        return;
      }

      const allAgents = await listAgents();
      for (const agent of allAgents) {
        const match = await bcrypt.compare(rawKey, agent.apiKeyHash);
        if (match) {
          (request as FastifyRequest & { agent: typeof agent }).agent = agent;
          return;
        }
      }
      await sendError(reply, 401, 'UNAUTHORIZED', 'Invalid agent key');
    },
  );
};

export default fp(authPlugin, { name: 'auth' });
