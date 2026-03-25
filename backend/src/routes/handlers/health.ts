import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as healthDb from '../../db/api/health.js';

const createGoalSchema = z.object({
  name: z.string(),
  type: z.enum(['diet', 'exercise', 'sleep', 'other']),
  target: z.string(),
  unit: z.string(),
  frequency: z.enum(['daily', 'weekly']).optional(),
});

const updateGoalSchema = createGoalSchema.partial();

const createEntrySchema = z.object({
  goalId: z.string().uuid(),
  value: z.string(),
  notes: z.string().optional(),
  date: z.string(),
});

const updateEntrySchema = z.object({
  value: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().optional(),
});

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/goals', { preHandler: fastify.authenticate }, async () => {
    return healthDb.listGoals();
  });

  fastify.post('/goals', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = createGoalSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' });
    const goal = await healthDb.createGoal(body.data);
    return reply.code(201).send(goal);
  });

  fastify.patch('/goals/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateGoalSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' });
    const goal = await healthDb.updateGoal(id, body.data);
    if (!goal) return reply.code(404).send({ error: 'Not found' });
    return goal;
  });

  fastify.delete('/goals/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await healthDb.deleteGoal(id);
    return reply.code(204).send();
  });

  fastify.get('/entries', { preHandler: fastify.authenticate }, async (request) => {
    const q = request.query as { goalId?: string; from?: string; to?: string };
    return healthDb.listEntries(q);
  });

  fastify.post('/entries', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = createEntrySchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' });
    const entry = await healthDb.createEntry(body.data);
    return reply.code(201).send(entry);
  });

  fastify.patch('/entries/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateEntrySchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' });
    const entry = await healthDb.updateEntry(id, body.data);
    if (!entry) return reply.code(404).send({ error: 'Not found' });
    return entry;
  });

  fastify.delete('/entries/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await healthDb.deleteEntry(id);
    return reply.code(204).send();
  });
};

export default healthRoutes;
