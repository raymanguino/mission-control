import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as projectsDb from '../../db/api/projects.js';
import { notifyChiefOfStaffOfProject } from '../../services/agentNotifier.js';
import { backendRequestSchemas } from '../../contracts/mcp-contract.js';
import { ApiError, parseBody } from '../../lib/errors.js';

const updateProjectSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['pending_approval', 'approved', 'denied']).optional(),
  url: z.string().url().nullable().optional(),
});

const projectRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: fastify.authenticate }, async () => {
    return projectsDb.listProjects();
  });

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    const project = await projectsDb.getProject(id);
    if (!project) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    return project;
  });

  fastify.post('/', { preHandler: [fastify.authenticate, fastify.enforceIdempotency] }, async (request, reply) => {
    const body = parseBody(backendRequestSchemas.createProject, request.body);
    const project = await projectsDb.createProject(body);
    await fastify.finalizeIdempotency(request, 201, project);

    notifyChiefOfStaffOfProject(project).catch((err) =>
      request.log.error({ err }, 'Failed to notify chief of staff webhook of new project'),
    );

    return reply.code(201).send(project);
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateProjectSchema, request.body);
    const project = await projectsDb.updateProject(id, body);
    if (!project) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    return project;
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await projectsDb.deleteProject(id);
    return reply.code(204).send();
  });

  fastify.get('/:id/tasks', { preHandler: fastify.authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    return projectsDb.listTasks(id);
  });
};

export default projectRoutes;
