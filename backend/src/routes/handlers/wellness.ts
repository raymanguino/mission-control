import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as wellnessDb from '../../db/api/wellness.js';
import { analyzeHealthData } from '../../services/analysis.js';
import { estimateNutrition } from '../../services/nutrition.js';
import { createFoodLogFromQuickText } from '../../services/quick-food-log.js';
import { ApiError, parseBody } from '../../lib/errors.js';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createFoodSchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  description: z.string().min(1),
  calories: z.number().int().positive().optional().nullable(),
  protein: z.coerce.number().min(0).optional().nullable(),
  carbs: z.coerce.number().min(0).optional().nullable(),
  fat: z.coerce.number().min(0).optional().nullable(),
  loggedAt: z.string(), // ISO datetime
  date: z.string(),     // YYYY-MM-DD
  notes: z.string().optional().nullable(),
});

const updateFoodSchema = createFoodSchema.partial();
const estimateFoodSchema = z.object({
  description: z.string().min(1),
});

const quickFoodSchema = z.object({
  text: z.string().min(1),
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
const runAnalysisSchema = z.object({
  goal: z.string().min(1),
  goals: z.array(z.string().min(1)).optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const wellnessRoutes: FastifyPluginAsync = async (fastify) => {
  // Food logs
  fastify.post(
    '/food/estimate',
    { preHandler: [fastify.authenticate, fastify.enforceIdempotency] },
    async (request, reply) => {
      const body = parseBody(estimateFoodSchema, request.body);

      try {
        const estimate = await estimateNutrition(body.description.trim());
        await fastify.finalizeIdempotency(request, 200, estimate);
        return estimate;
      } catch (err) {
        request.log.error({ err }, 'Nutrition estimation failed');
        throw new ApiError(500, 'INTERNAL_ERROR', 'Nutrition estimation failed');
      }
    },
  );

  fastify.get('/food', { preHandler: fastify.authenticate }, async (request) => {
    const q = request.query as { date?: string; from?: string; to?: string };
    return wellnessDb.listFoodLogs(q);
  });

  fastify.post('/food', { preHandler: [fastify.authenticate, fastify.enforceIdempotency] }, async (request, reply) => {
    const body = parseBody(createFoodSchema, request.body);
    const log = await wellnessDb.createFoodLog({
      ...body,
      loggedAt: new Date(body.loggedAt),
    });
    await fastify.finalizeIdempotency(request, 201, log);
    return reply.code(201).send(log);
  });

  fastify.post(
    '/food/quick',
    { preHandler: [fastify.authenticate, fastify.enforceIdempotency] },
    async (request, reply) => {
      const body = parseBody(quickFoodSchema, request.body);
      try {
        const log = await createFoodLogFromQuickText(body.text);
        await fastify.finalizeIdempotency(request, 201, log);
        return reply.code(201).send(log);
      } catch (err) {
        request.log.error({ err }, 'Quick food log failed');
        throw new ApiError(500, 'INTERNAL_ERROR', 'Quick food log failed');
      }
    },
  );

  fastify.patch('/food/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateFoodSchema, request.body);
    const { loggedAt, ...rest } = body;
    const data: Parameters<typeof wellnessDb.updateFoodLog>[1] = {
      ...rest,
      ...(loggedAt ? { loggedAt: new Date(loggedAt) } : {}),
    };
    const log = await wellnessDb.updateFoodLog(id, data);
    if (!log) throw new ApiError(404, 'NOT_FOUND', 'Not found');
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

  fastify.post('/marijuana', { preHandler: [fastify.authenticate, fastify.enforceIdempotency] }, async (request, reply) => {
    const body = parseBody(createMarijuanaSchema, request.body);
    const session = await wellnessDb.createMarijuanaSession({
      ...body,
      sessionAt: new Date(body.sessionAt),
    });
    await fastify.finalizeIdempotency(request, 201, session);
    return reply.code(201).send(session);
  });

  fastify.patch(
    '/marijuana/:id',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = parseBody(updateMarijuanaSchema, request.body);
      const { sessionAt, ...rest } = body;
      const data: Parameters<typeof wellnessDb.updateMarijuanaSession>[1] = {
        ...rest,
        ...(sessionAt ? { sessionAt: new Date(sessionAt) } : {}),
      };
      const session = await wellnessDb.updateMarijuanaSession(id, data);
      if (!session) throw new ApiError(404, 'NOT_FOUND', 'Not found');
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

  fastify.post('/sleep', { preHandler: [fastify.authenticate, fastify.enforceIdempotency] }, async (request, reply) => {
    const body = parseBody(createSleepSchema, request.body);
    const log = await wellnessDb.createSleepLog({
      ...body,
      bedTime: new Date(body.bedTime),
      wakeTime: body.wakeTime ? new Date(body.wakeTime) : null,
    });
    await fastify.finalizeIdempotency(request, 201, log);
    return reply.code(201).send(log);
  });

  fastify.patch('/sleep/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateSleepSchema, request.body);
    const { bedTime, wakeTime, ...rest } = body;
    const data: Parameters<typeof wellnessDb.updateSleepLog>[1] = {
      ...rest,
      ...(bedTime ? { bedTime: new Date(bedTime) } : {}),
      ...(wakeTime !== undefined ? { wakeTime: wakeTime ? new Date(wakeTime) : null } : {}),
    };
    const log = await wellnessDb.updateSleepLog(id, data);
    if (!log) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    return log;
  });

  fastify.delete('/sleep/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await wellnessDb.deleteSleepLog(id);
    return reply.code(204).send();
  });

  // AI Insights analysis
  fastify.post(
    '/analysis',
    { preHandler: [fastify.authenticate, fastify.enforceIdempotency] },
    async (request, reply) => {
      const body = parseBody(runAnalysisSchema, request.body);
      try {
        const result = await analyzeHealthData({
          goal: body.goal.trim(),
          goals: body.goals?.map((goal) => goal.trim()).filter(Boolean),
        });
        await fastify.finalizeIdempotency(request, 200, result);
        return result;
      } catch (err) {
        request.log.error({ err }, 'Health analysis failed');
        throw new ApiError(500, 'INTERNAL_ERROR', 'Analysis failed');
      }
    },
  );
};

export default wellnessRoutes;
