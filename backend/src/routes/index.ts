import type { FastifyInstance } from 'fastify';
import authRoutes from './handlers/auth.js';
import agentRoutes from './handlers/agents.js';
import projectRoutes from './handlers/projects.js';
import taskRoutes from './handlers/tasks.js';
import wellnessRoutes from './handlers/wellness.js';
import channelRoutes from './handlers/channels.js';
import usageRoutes from './handlers/usage.js';
import settingsRoutes from './handlers/settings.js';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(agentRoutes, { prefix: '/api/agents' });
  await app.register(projectRoutes, { prefix: '/api/projects' });
  await app.register(taskRoutes, { prefix: '/api/tasks' });
  await app.register(wellnessRoutes, { prefix: '/api/health' });
  await app.register(channelRoutes, { prefix: '/api/channels' });
  await app.register(usageRoutes, { prefix: '/api/usage' });
  await app.register(settingsRoutes, { prefix: '/api/settings' });
}
