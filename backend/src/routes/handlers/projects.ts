import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as agentsDb from '../../db/api/agents.js';
import * as projectsDb from '../../db/api/projects.js';
import { notifyChiefOfStaffOfProject } from '../../services/agentNotifier.js';
import { backendRequestSchemas } from '../../contracts/mcp-contract.js';
import { ApiError, parseBody } from '../../lib/errors.js';
import { decomposeProjectIntoTasks } from '../../lib/apiyi.js';
import { pickAgentByOrgRoleLeastLoaded } from '../../lib/pickAgentByLoad.js';
import { createTask } from '../../db/api/projects.js';

const updateProjectSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['pending_approval', 'approved', 'denied']).optional(),
  url: z.string().url().nullable().optional(),
  /** Dashboard may set explicitly; CoS agents get this from API key auth. */
  approvedByAgentId: z.string().uuid().nullable().optional(),
});

/** Map task specialization to agent orgRole */
function mapSpecializationToRole(specialization: string): string {
  const roleMap: Record<string, string> = {
    frontend: 'engineer',
    backend: 'engineer',
    devops: 'devops',
    python: 'engineer',
    qa: 'qa',
    testing: 'qa',
    docs: 'engineer',
    database: 'engineer',
  };
  return roleMap[specialization.toLowerCase()] || 'engineer';
}

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

    notifyChiefOfStaffOfProject(project).catch((err) => {
      request.log.error({ err }, 'Failed to notify chief of staff webhook of new project');
      console.error('[PROJECTS] Webhook notification failed:', err);
      console.error('[PROJECTS] Project:', project);
    });

    return reply.code(201).send(project);
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateProjectSchema, request.body);
    const current = await projectsDb.getProject(id);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Not found');

    const { approvedByAgentId: bodyApproverId, ...rest } = body;
    const nextStatus = body.status ?? current.status;

    const effectiveUrlAfterPatch =
      body.url !== undefined
        ? body.url === null
          ? null
          : body.url.trim() || null
        : current.url?.trim()
          ? current.url.trim()
          : null;

    if (current.status !== 'approved' && nextStatus === 'approved' && !effectiveUrlAfterPatch) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project URL is required to approve a project', {
        reason: 'approval_requires_url',
      });
    }

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
    
    // Auto-decompose project into tasks when approval status changes to 'approved'
    if (nextStatus === 'approved' && current.status !== 'approved') {
      try {
        const tasks = await decomposeProjectIntoTasks(project.name, project.description || '');
        
        if (tasks.length > 0) {
          const created = [];
          
          for (const taskSpec of tasks) {
            // Map specialization to agent orgRole
            const targetRole = mapSpecializationToRole(taskSpec.specialization);
            const agent = await pickAgentByOrgRoleLeastLoaded(targetRole);
            
            const task = await createTask({
              projectId: id,
              title: taskSpec.title,
              description: taskSpec.description,
              status: 'backlog',
              assignedAgentId: agent?.id || null,
            });
            created.push(task);
          }
          
          request.log.info({ projectId: id, taskCount: created.length }, 'Auto-decomposed project into tasks');
        }
      } catch (error) {
        request.log.error({ error }, 'Failed to decompose project, proceeding without tasks');
        // Continue with approval even if decomposition fails
      }
    }
    
    return project;
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await projectsDb.deleteProject(id);
    return reply.code(204).send();
  });
};

export default projectRoutes;
