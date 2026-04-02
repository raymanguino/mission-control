import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { touchMcpActivity } from '../lib/mcpActivity.js';

const mcpActivityPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onResponse', async (request, reply) => {
    const status = reply.statusCode;
    if (status < 200 || status >= 300) return;

    const path = request.url.split('?')[0] ?? '';
    if (!path.startsWith('/api/') || path.startsWith('/api/auth/')) return;

    const agentId = request.agent?.id;
    if (!agentId) return;

    try {
      await touchMcpActivity([agentId]);
    } catch (err) {
      request.log.error({ err }, 'MCP activity touch failed');
    }
  });
};

export default fp(mcpActivityPlugin, { name: 'mcpActivity' });
