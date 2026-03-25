import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as wellnessDb from '../../db/api/wellness.js';
import { analyzeHealthData } from '../../services/analysis.js';
import { estimateNutrition } from '../../services/nutrition.js';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createFoodSchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  description: z.string().min(1),
  calories: z.number().int().positive().optional().nullable(),
  protein: z.string().optional().nullable(),
  carbs: z.string().optional().nullable(),
  fat: z.string().optional().nullable(),
  loggedAt: z.string(), // ISO datetime
  date: z.string(),     // YYYY-MM-DD
  notes: z.string().optional().nullable(),
});

const updateFoodSchema = createFoodSchema.partial();
const estimateFoodSchema = z.object({
  description: z.string().min(1),
});

const createMarijuanaSchema = z.object({
  form: z.enum(['flower', 'vape', 'edible', 'tincture', 'other']),
  strain: z.string().optional().nullable(),
  amount: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  sessionAt: z.string(), // ISO datetime — critical for time-of-day correlation
  date: z.string(),      // YYYY-MM-DD
});

const updateMarijuanaSchema = createMarijuanaSchema.partial();

const createSleepSchema = z.object({
  bedTime: z.string(),  // ISO datetime
  wakeTime: z.string().optional().nullable(),
  qualityScore: z.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().optional().nullable(),
  date: z.string(),     // YYYY-MM-DD (the night's date)
});

const updateSleepSchema = createSleepSchema.partial();

// ─── Routes ───────────────────────────────────────────────────────────────────

const wellnessRoutes: FastifyPluginAsync = async (fastify) => {
  // Food logs
  fastify.post('/food/estimate', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = estimateFoodSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid body' });
    }

    try {
      const estimate = await estimateNutrition(body.data.description.trim());
      return estimate;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nutrition estimation failed';
      return reply.code(500).send({ error: msg });
    }
  });

  fastify.get('/food', { preHandler: fastify.authenticate }, async (request) => {
    const q = request.query as { date?: string; from?: string; to?: string };
    return wellnessDb.listFoodLogs(q);
  });

  fastify.post('/food', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = createFoodSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' });
    const log = await wellnessDb.createFoodLog({
      ...body.data,
      loggedAt: new Date(body.data.loggedAt),
    });
    return reply.code(201).send(log);
  });

  fastify.patch('/food/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateFoodSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' });
    const { loggedAt, ...rest } = body.data;
    const data: Parameters<typeof wellnessDb.updateFoodLog>[1] = {
      ...rest,
      ...(loggedAt ? { loggedAt: new Date(loggedAt) } : {}),
    };
    const log = await wellnessDb.updateFoodLog(id, data);
    if (!log) return reply.code(404).send({ error: 'Not found' });
    return log;
  });

  fastify.delete('/food/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await wellnessDb.deleteFoodLog(id);
    return reply.code(204).send();
  });

  // Marijuana sessions
  fastify.get('/marijuana', { preHandler: fastify.authenticate }, async (request) => {
    const q = request.query as { date?: string; from?: string; to?: string };
    return wellnessDb.listMarijuanaSessions(q);
  });

  fastify.post('/marijuana', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = createMarijuanaSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' });
    const session = await wellnessDb.createMarijuanaSession({
      ...body.data,
      sessionAt: new Date(body.data.sessionAt),
    });
    return reply.code(201).send(session);
  });

  fastify.patch(
    '/marijuana/:id',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateMarijuanaSchema.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: 'Invalid body' });
      const { sessionAt, ...rest } = body.data;
      const data: Parameters<typeof wellnessDb.updateMarijuanaSession>[1] = {
        ...rest,
        ...(sessionAt ? { sessionAt: new Date(sessionAt) } : {}),
      };
      const session = await wellnessDb.updateMarijuanaSession(id, data);
      if (!session) return reply.code(404).send({ error: 'Not found' });
      return session;
    },
  );

  fastify.delete(
    '/marijuana/:id',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await wellnessDb.deleteMarijuanaSession(id);
      return reply.code(204).send();
    },
  );

  // Sleep logs
  fastify.get('/sleep', { preHandler: fastify.authenticate }, async (request) => {
    const q = request.query as { from?: string; to?: string };
    return wellnessDb.listSleepLogs(q);
  });

  fastify.post('/sleep', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = createSleepSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' });
    const log = await wellnessDb.createSleepLog({
      ...body.data,
      bedTime: new Date(body.data.bedTime),
      wakeTime: body.data.wakeTime ? new Date(body.data.wakeTime) : null,
    });
    return reply.code(201).send(log);
  });

  fastify.patch('/sleep/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateSleepSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' });
    const { bedTime, wakeTime, ...rest } = body.data;
    const data: Parameters<typeof wellnessDb.updateSleepLog>[1] = {
      ...rest,
      ...(bedTime ? { bedTime: new Date(bedTime) } : {}),
      ...(wakeTime !== undefined ? { wakeTime: wakeTime ? new Date(wakeTime) : null } : {}),
    };
    const log = await wellnessDb.updateSleepLog(id, data);
    if (!log) return reply.code(404).send({ error: 'Not found' });
    return log;
  });

  fastify.delete('/sleep/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await wellnessDb.deleteSleepLog(id);
    return reply.code(204).send();
  });

  // AI Analysis
  fastify.get('/analysis', { preHandler: fastify.authenticate }, async (_request, reply) => {
    try {
      const result = await analyzeHealthData();
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      return reply.code(500).send({ error: msg });
    }
  });
};

export default wellnessRoutes;
