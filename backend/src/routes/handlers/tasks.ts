import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import * as projectsDb from '../../db/api/projects.js';
import * as agentsDb from '../../db/api/agents.js';
import * as settingsDb from '../../db/api/settings.js';
import * as emailService from '../../services/email.js';
import { notifyRalphOfTask } from '../../services/ralph.js';
import { backendRequestSchemas } from '../../contracts/mcp-contract.js';
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
    if (!agent?.email || !task) return;
    const project = await projectsDb.getProject(task.projectId);
    if (!project) return;
    const instructions = (await settingsDb.getSetting('agent_instructions')) ?? '';
    await emailService.notifyAgentOfTask(
      { email: agent.email, name: agent.name },
      task,
      project,
      instructions,
    );
  } catch (err) {
    log.error({ err }, 'Failed to notify agent of task assignment');
  }
}

const taskRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    const task = await projectsDb.getTask(id);
    if (!task) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    return task;
  });

  fastify.post('/', { preHandler: [fastify.authenticate, fastify.enforceIdempotency] }, async (request, reply) => {
    const body = parseBody(createTaskSchema, request.body);
    const task = await projectsDb.createTask(body);
    await fastify.finalizeIdempotency(request, 201, task);

    if (body.assignedAgentId) {
      await notifyAssignedAgent(task.id, body.assignedAgentId, request.log);
      // Notify Ralph (OpenClaw CoS) directly over Tailscale (fire-and-forget)
      const project = await projectsDb.getProject(task.projectId);
      notifyRalphOfTask(task, project?.name ?? task.projectId).catch((err) =>
        request.log.error({ err }, 'Failed to notify Ralph of task assignment'),
      );
    }

    return reply.code(201).send(task);
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateTaskSchema, request.body);

    // Auto-unassign when status moves to review
    const updateData =
      body.status === 'review' ? { ...body, assignedAgentId: null } : body;

    const task = await projectsDb.updateTask(id, updateData);
    if (!task) throw new ApiError(404, 'NOT_FOUND', 'Not found');

    // Notify newly assigned agent (skip if we're also clearing via review auto-unassign)
    if (body.assignedAgentId && body.status !== 'review') {
      await notifyAssignedAgent(id, body.assignedAgentId, request.log);
      // Notify Ralph (OpenClaw CoS) directly over Tailscale (fire-and-forget)
      const project = await projectsDb.getProject(task.projectId);
      notifyRalphOfTask(task, project?.name ?? task.projectId).catch((err) =>
        request.log.error({ err }, 'Failed to notify Ralph of task assignment'),
      );
    }

    return task;
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await projectsDb.deleteTask(id);
    return reply.code(204).send();
  });
};

export default taskRoutes;
