import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { listAgents } from '../db/api/agents.js';
import { sendError } from '../lib/errors.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateAgent: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const serviceToken = process.env['MISSION_CONTROL_SERVICE_TOKEN'];

  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const authorization = request.headers['authorization'];
      if (serviceToken && typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
        const bearerToken = authorization.slice(7);
        if (secureEquals(bearerToken, serviceToken)) {
          return;
        }
      }

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

function secureEquals(value: string, expected: string): boolean {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  if (valueBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(valueBuffer, expectedBuffer);
}

export default fp(authPlugin, { name: 'auth' });
