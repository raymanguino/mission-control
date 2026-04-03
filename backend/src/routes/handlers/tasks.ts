import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import * as projectsDb from '../../db/api/projects.js';
import * as agentsDb from '../../db/api/agents.js';
import * as settingsDb from '../../db/api/settings.js';
import * as emailService from '../../services/email.js';
import { notifyAssignedAgentOfTask } from '../../services/agentNotifier.js';
import { backendRequestSchemas } from '../../contracts/mcp-contract.js';
import { touchMcpActivity } from '../../lib/mcpActivity.js';
import { ApiError, parseBody } from '../../lib/errors.js';

const createTaskSchema = backendRequestSchemas.createTask;
const updateTaskSchema = backendRequestSchemas.updateTask;

async function notifyAssignedAgent(
  taskId: string,
  assignedAgentId: string,
  log: FastifyBaseLogger,
): Promise<void> {
  try {
    const [agent, task] = await Promise.all([
      agentsDb.getAgent(assignedAgentId),
      projectsDb.getTask(taskId),
    ]);
    if (!agent || !task) return;
    const project = await projectsDb.getProject(task.projectId);
    if (!project) return;

    if (agent.hookUrl?.trim() && agent.hookToken?.trim()) {
      notifyAssignedAgentOfTask(agent, task, project.name).catch((err) =>
        log.error({ err }, 'Failed to POST task assignment to agent webhook'),
      );
    }

    if (agent.email) {
      const instructions = (await settingsDb.getSetting('agent_instructions')) ?? '';
      await emailService.notifyAgentOfTask(
        { email: agent.email, name: agent.name },
        task,
        project,
        instructions,
      );
    }
  } catch (err) {
    log.error({ err }, 'Failed to notify agent of task assignment');
  }
}

const taskRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    const task = await projectsDb.getTask(id);
    if (!task) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    await touchMcpActivity([task.assignedAgentId]);
    return task;
  });

  fastify.post('/', { preHandler: [fastify.authenticate, fastify.enforceIdempotency] }, async (request, reply) => {
    const body = parseBody(createTaskSchema, request.body);
    const project = await projectsDb.getProject(body.projectId);
    if (!project) {
      throw new ApiError(400, 'BAD_REQUEST', 'Unknown projectId');
    }
    if (project.status !== 'approved') {
      throw new ApiError(
        409,
        'CONFLICT',
        'Project must be approved before tasks can be created',
        { reason: 'project_not_approved', status: project.status },
      );
    }
    if (body.assignedAgentId) {
      const agent = await agentsDb.getAgent(body.assignedAgentId);
      if (!agent) {
        throw new ApiError(400, 'BAD_REQUEST', 'Unknown assignedAgentId');
      }
    }
    const task = await projectsDb.createTask(body);
    await fastify.finalizeIdempotency(request, 201, task);

    if (body.assignedAgentId) {
      await touchMcpActivity([body.assignedAgentId]);
      await notifyAssignedAgent(task.id, body.assignedAgentId, request.log);
    }

    return reply.code(201).send(task);
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateTaskSchema, request.body);

    // Auto-unassign when status moves to review
    const updateData =
      body.status === 'review' ? { ...body, assignedAgentId: null } : body;

    if (updateData.assignedAgentId) {
      const agent = await agentsDb.getAgent(updateData.assignedAgentId);
      if (!agent) {
        throw new ApiError(400, 'BAD_REQUEST', 'Unknown assignedAgentId');
      }
    }

    const task = await projectsDb.updateTask(id, updateData);
    if (!task) throw new ApiError(404, 'NOT_FOUND', 'Not found');

    await touchMcpActivity([task.assignedAgentId]);

    // Notify newly assigned agent (skip if we're also clearing via review auto-unassign)
    if (body.assignedAgentId && body.status !== 'review') {
      await notifyAssignedAgent(id, body.assignedAgentId, request.log);
    }

    return task;
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await projectsDb.getTask(id);
    if (existing?.assignedAgentId) {
      await touchMcpActivity([existing.assignedAgentId]);
    }
    await projectsDb.deleteTask(id);
    return reply.code(204).send();
  });
};

export default taskRoutes;
