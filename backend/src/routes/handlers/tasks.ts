import type { FastifyPluginAsync } from 'fastify';
import * as projectsDb from '../../db/api/projects.js';
import { backendRequestSchemas } from '../../contracts/mcp-contract.js';
import { ApiError, parseBody } from '../../lib/errors.js';

const createTaskSchema = backendRequestSchemas.createTask;
const updateTaskSchema = backendRequestSchemas.updateTask;

const taskRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', { preHandler: [fastify.authenticate, fastify.enforceIdempotency] }, async (request, reply) => {
    const body = parseBody(createTaskSchema, request.body);
    const task = await projectsDb.createTask(body);
    await fastify.finalizeIdempotency(request, 201, task);
    return reply.code(201).send(task);
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateTaskSchema, request.body);
    const task = await projectsDb.updateTask(id, body);
    if (!task) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    return task;
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await projectsDb.deleteTask(id);
    return reply.code(204).send();
  });
};

export default taskRoutes;
