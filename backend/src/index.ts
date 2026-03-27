import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import authPlugin from './plugins/auth.js';
import idempotencyPlugin from './plugins/idempotency.js';
import { registerRoutes } from './routes/index.js';
import { startCronJobs } from './services/cron.js';
import { registerErrorHandling } from './lib/errors.js';
import { getDiscordSyncService, startDiscordSync, stopDiscordSync } from './services/discord/index.js';

const app = Fastify({ logger: true });

const secret = process.env['DASHBOARD_SECRET'];
if (!secret) throw new Error('DASHBOARD_SECRET is required');

await app.register(cors, {
  origin: process.env['FRONTEND_ORIGIN'] ?? 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

await app.register(jwt, { secret });
await app.register(authPlugin);
await app.register(idempotencyPlugin);

registerErrorHandling(app);
await registerRoutes(app);

app.get('/healthz', async () => ({
  ok: true,
  discord: getDiscordSyncService()?.getHealth() ?? { enabled: false, connected: false, guildId: null },
}));

const port = Number(process.env['PORT'] ?? 3001);

await startDiscordSync(app.log);
await app.listen({ port, host: '0.0.0.0' });

startCronJobs();

const shutdown = async () => {
  await stopDiscordSync();
  await app.close();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
