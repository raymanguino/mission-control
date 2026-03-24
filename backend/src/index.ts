import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import authPlugin from './plugins/auth.js';
import { registerRoutes } from './routes/index.js';
import { startCronJobs } from './services/cron.js';

const app = Fastify({ logger: true });

const secret = process.env['DASHBOARD_SECRET'];
if (!secret) throw new Error('DASHBOARD_SECRET is required');

await app.register(cors, {
  origin: process.env['FRONTEND_ORIGIN'] ?? 'http://localhost:5173',
  credentials: true,
});

await app.register(jwt, { secret });
await app.register(authPlugin);

await registerRoutes(app);

app.get('/healthz', async () => ({ ok: true }));

const port = Number(process.env['PORT'] ?? 3001);
await app.listen({ port, host: '0.0.0.0' });

startCronJobs();
