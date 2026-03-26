import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as projectsDb from '../../db/api/projects.js';

const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['backlog', 'doing', 'review', 'done']).optional(),
  assignedAgentId: z.string().uuid().optional(),
  order: z.number().int().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['backlog', 'doing', 'review', 'done']).optional(),
  assignedAgentId: z.string().uuid().nullable().optional(),
  order: z.number().int().optional(),
});

const taskRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', { preHandler: [fastify.authenticate, fastify.enforceIdempotency] }, async (request, reply) => {
    const body = createTaskSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' });
    const task = await projectsDb.createTask(body.data);
    await fastify.finalizeIdempotency(request, 201, task);
    return reply.code(201).send(task);
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateTaskSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' });
    const task = await projectsDb.updateTask(id, body.data);
    if (!task) return reply.code(404).send({ error: 'Not found' });
    return task;
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await projectsDb.deleteTask(id);
    return reply.code(204).send();
  });
};

export default taskRoutes;
