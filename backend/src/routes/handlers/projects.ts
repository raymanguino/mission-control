import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as agentsDb from '../../db/api/agents.js';
import * as projectsDb from '../../db/api/projects.js';
import { notifyChiefOfStaffOfProject } from '../../services/agentNotifier.js';
import { backendRequestSchemas } from '../../contracts/mcp-contract.js';
import { ApiError, parseBody } from '../../lib/errors.js';

const updateProjectSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['pending_approval', 'approved', 'denied']).optional(),
  url: z.string().url().nullable().optional(),
  /** Dashboard may set explicitly; CoS agents get this from API key auth. */
  approvedByAgentId: z.string().uuid().nullable().optional(),
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
    const current = await projectsDb.getProject(id);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Not found');

    const { approvedByAgentId: bodyApproverId, ...rest } = body;
    const nextStatus = body.status ?? current.status;

    const patch: Parameters<typeof projectsDb.updateProject>[1] = { ...rest };

    if (nextStatus !== 'approved') {
      patch.approvedByAgentId = null;
    } else if (current.status !== 'approved' && nextStatus === 'approved') {
      if (request.agent?.orgRole === 'chief_of_staff') {
        patch.approvedByAgentId = request.agent.id;
      } else if (bodyApproverId !== undefined) {
        if (bodyApproverId === null) {
          patch.approvedByAgentId = null;
        } else {
          const agent = await agentsDb.getAgent(bodyApproverId);
          if (!agent || agent.orgRole !== 'chief_of_staff') {
            throw new ApiError(
              400,
              'BAD_REQUEST',
              'approvedByAgentId must refer to an agent with chief_of_staff role',
            );
          }
          patch.approvedByAgentId = agent.id;
        }
      } else {
        patch.approvedByAgentId = null;
      }
    }

    const project = await projectsDb.updateProject(id, patch);
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
