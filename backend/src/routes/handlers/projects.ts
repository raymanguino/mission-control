import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as projectsDb from '../../db/api/projects.js';

const createProjectSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
});

const projectRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: fastify.authenticate }, async () => {
    return projectsDb.listProjects();
  });

  fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = createProjectSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' });
    const project = await projectsDb.createProject(body.data);
    return reply.code(201).send(project);
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateProjectSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' });
    const project = await projectsDb.updateProject(id, body.data);
    if (!project) return reply.code(404).send({ error: 'Not found' });
    return project;
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await projectsDb.deleteProject(id);
    return reply.code(204).send();
  });

  fastify.get('/:id/tasks', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return projectsDb.listTasks(id);
  });
};

export default projectRoutes;
