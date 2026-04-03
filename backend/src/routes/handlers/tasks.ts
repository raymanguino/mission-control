import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import * as projectsDb from '../../db/api/projects.js';
import * as agentsDb from '../../db/api/agents.js';
import * as settingsDb from '../../db/api/settings.js';
import * as emailService from '../../services/email.js';
import {
  notifyAssignedAgentOfReviewAssigned,
  notifyAssignedAgentOfTask,
  notifyChiefOfStaffOfTaskCompleted,
} from '../../services/agentNotifier.js';
import { backendRequestSchemas } from '../../contracts/mcp-contract.js';
import { touchMcpActivity } from '../../lib/mcpActivity.js';
import { ApiError, parseBody } from '../../lib/errors.js';

const createTaskSchema = backendRequestSchemas.createTask;
const updateTaskSchema = backendRequestSchemas.updateTask;

const taskActivityMeta = (task: {
  id: string;
  projectId: string;
  title: string;
  status: string;
  projectName: string;
}) => ({
  taskId: task.id,
  projectId: task.projectId,
  projectName: task.projectName,
  title: task.title,
  status: task.status,
});

/** Inserts a fleet-visible row in `agent_activities` and updates MCP presence for that agent. */
async function logFleetTaskActivity(
  agentId: string | null | undefined,
  args: { type: string; description: string; metadata: Record<string, unknown> },
): Promise<void> {
  if (!agentId) return;
  await agentsDb.insertActivity({
    agentId,
    type: args.type,
    description: args.description,
    metadata: args.metadata,
  });
  await touchMcpActivity([agentId]);
}

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

async function notifyReviewAssignedAgent(
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
      notifyAssignedAgentOfReviewAssigned(agent, task, project.name).catch((err) =>
        log.error({ err }, 'Failed to POST task.review_assigned to agent webhook'),
      );
    }

    if (agent.email) {
      const instructions = (await settingsDb.getSetting('agent_instructions')) ?? '';
      await emailService.notifyAgentOfReviewTask(
        { email: agent.email, name: agent.name },
        task,
        project,
        instructions,
      );
    }
  } catch (err) {
    log.error({ err }, 'Failed to notify agent of review task assignment');
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
      await logFleetTaskActivity(body.assignedAgentId, {
        type: 'task_created',
        description: `Task "${task.title}" created in ${project.name}`,
        metadata: taskActivityMeta({ ...task, projectName: project.name }),
      });
      if (task.status === 'review') {
        await notifyReviewAssignedAgent(task.id, body.assignedAgentId, request.log);
      } else {
        await notifyAssignedAgent(task.id, body.assignedAgentId, request.log);
      }
    }

    return reply.code(201).send(task);
  });

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateTaskSchema, request.body);

    const existing = await projectsDb.getTask(id);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Not found');

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

    const project = await projectsDb.getProject(task.projectId);
    const projectName = project?.name ?? 'Project';
    const meta = taskActivityMeta({ ...task, projectName });

    if (existing.assignedAgentId && existing.assignedAgentId !== task.assignedAgentId) {
      await logFleetTaskActivity(existing.assignedAgentId, {
        type: 'task_unassigned',
        description: `No longer assigned to "${task.title}" in ${projectName}`,
        metadata: meta,
      });
    }
    if (task.assignedAgentId && task.assignedAgentId !== existing.assignedAgentId) {
      await logFleetTaskActivity(task.assignedAgentId, {
        type: 'task_assigned',
        description: `Assigned "${task.title}" in ${projectName}`,
        metadata: meta,
      });
    } else if (task.assignedAgentId && task.assignedAgentId === existing.assignedAgentId) {
      await logFleetTaskActivity(task.assignedAgentId, {
        type: 'task_updated',
        description: `Task "${task.title}" updated in ${projectName}`,
        metadata: meta,
      });
    }

    // Notify newly assigned agent (skip if we're also clearing via review auto-unassign)
    const newAssigneeId = task.assignedAgentId;
    if (newAssigneeId && existing.assignedAgentId !== newAssigneeId) {
      if (task.status === 'review') {
        await notifyReviewAssignedAgent(id, newAssigneeId, request.log);
      } else {
        await notifyAssignedAgent(id, newAssigneeId, request.log);
      }
    }

    if (existing.status !== 'review' && task.status === 'review') {
      notifyChiefOfStaffOfTaskCompleted(task, projectName).catch((err) =>
        request.log.error({ err }, 'Failed to POST task.completed to chief of staff webhook'),
      );
    }

    return task;
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await projectsDb.getTask(id);
    if (existing?.assignedAgentId) {
      const project = await projectsDb.getProject(existing.projectId);
      const projectName = project?.name ?? 'Project';
      await logFleetTaskActivity(existing.assignedAgentId, {
        type: 'task_deleted',
        description: `Task "${existing.title}" removed from ${projectName}`,
        metadata: taskActivityMeta({ ...existing, projectName }),
      });
    }
    await projectsDb.deleteTask(id);
    return reply.code(204).send();
  });
};

export default taskRoutes;
