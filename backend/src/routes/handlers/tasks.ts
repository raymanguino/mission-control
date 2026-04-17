import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import * as projectsDb from '../../db/api/projects.js';
import * as agentsDb from '../../db/api/agents.js';
import * as settingsDb from '../../db/api/settings.js';
import * as emailService from '../../services/email.js';
import {
  notifyAssignedAgentOfTask,
  notifyChiefOfStaffOfProjectCompleted,
  notifyChiefOfStaffOfReviewCompleted,
  notifyQaOfProjectAllTasksInReviewWebhook,
} from '../../services/agentNotifier.js';
import { getDiscordSyncService } from '../../services/discord/index.js';
import {
  formatDiscordProjectFailure,
  formatDiscordProjectSuccess,
  resolveGeneralDiscordChannelId,
  sendDiscordToGeneral,
} from '../../services/discord/projectAnnouncements.js';
import { pickAgentByOrgRoleLeastLoaded } from '../../lib/pickAgentByLoad.js';
import { backendRequestSchemas } from '../../contracts/mcp-contract.js';
import { touchMcpActivity } from '../../lib/mcpActivity.js';
import { ApiError, parseBody } from '../../lib/errors.js';
import { isUuid } from '../../lib/mcpActivity.js';
import { instructionKeyForOrgRole } from '../../lib/agentOrgRoles.js';

function assertProjectTaskParams(projectId: string, taskId?: string): void {
  if (!isUuid(projectId)) {
    throw new ApiError(400, 'BAD_REQUEST', 'Invalid projectId');
  }
  if (taskId !== undefined && !isUuid(taskId)) {
    throw new ApiError(400, 'BAD_REQUEST', 'Invalid taskId');
  }
}

const createTaskBodySchema = backendRequestSchemas.createTask.omit({ projectId: true });
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

    log.info(`notifyAssignedAgent: ${JSON.stringify(agent, null, 2)}`);

    if (agent.hookUrl?.trim() && agent.hookToken?.trim()) {
      notifyAssignedAgentOfTask(
        {
          ...agent,
          orgRole: agent.orgRole,
        },
        task,
        {
          id: project.id,
          name: project.name,
          description: project.description,
          url: project.url,
        },
      ).catch((err: unknown) =>
        log.error({ err }, 'Failed to POST task assignment to agent webhook'),
      );
    }

    if (agent.email) {
      const key = instructionKeyForOrgRole(agent.orgRole);
      const instructions = (await settingsDb.getSetting(key)) ?? '';
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

/** QA batch gate: every task in the project is `review` (webhook includes `allTasksInReview`). */
async function notifyQaBatchWhenAllTasksInReview(
  taskId: string,
  qaAgentId: string,
  log: FastifyBaseLogger,
): Promise<void> {
  try {
    const [agent, task] = await Promise.all([
      agentsDb.getAgent(qaAgentId),
      projectsDb.getTask(taskId),
    ]);
    if (!agent || !task) return;
    const project = await projectsDb.getProject(task.projectId);
    if (!project) return;

    if (agent.hookUrl?.trim() && agent.hookToken?.trim()) {
      notifyQaOfProjectAllTasksInReviewWebhook(
        agent,
        task,
        {
          id: project.id,
          name: project.name,
          description: project.description,
          url: project.url,
        },
        project.name,
      ).catch((err) =>
        log.error({ err }, 'Failed to POST task.completed (batch) to QA webhook'),
      );
    }

    if (agent.email) {
      const key = instructionKeyForOrgRole(agent.orgRole);
      const instructions = (await settingsDb.getSetting(key)) ?? '';
      await emailService.notifyAgentOfReviewTask(
        { email: agent.email, name: agent.name },
        task,
        project,
        instructions,
      );
    }
  } catch (err) {
    log.error({ err }, 'Failed to notify QA of batch review');
  }
}

const taskRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: fastify.authenticate }, async (request) => {
    const { projectId } = request.params as { projectId: string };
    assertProjectTaskParams(projectId);
    return projectsDb.listTasks(projectId);
  });

  fastify.get('/:taskId', { preHandler: fastify.authenticate }, async (request) => {
    const { projectId, taskId } = request.params as { projectId: string; taskId: string };
    assertProjectTaskParams(projectId, taskId);
    const task = await projectsDb.getTask(taskId);
    if (!task || task.projectId !== projectId) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    await touchMcpActivity([task.assignedAgentId]);
    return task;
  });

  fastify.post('/', { preHandler: [fastify.authenticate, fastify.enforceIdempotency] }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    assertProjectTaskParams(projectId);
    const body = parseBody(createTaskBodySchema, request.body);
    const project = await projectsDb.getProject(projectId);
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
    if (body.status === 'review' && !project.url?.trim()) {
      throw new ApiError(
        409,
        'CONFLICT',
        'Project must have a URL before tasks can move to review',
        { reason: 'project_url_required_for_review' },
      );
    }
    let assignedAgentId: string | null;
    if (body.assignedAgentId !== undefined) {
      if (body.assignedAgentId === null) {
        assignedAgentId = null;
      } else {
        const agent = await agentsDb.getAgent(body.assignedAgentId);
        if (!agent) {
          throw new ApiError(400, 'BAD_REQUEST', 'Unknown assignedAgentId');
        }
        assignedAgentId = body.assignedAgentId;
      }
    } else {
      assignedAgentId = null;
    }

    const createPayload: Parameters<typeof projectsDb.createTask>[0] = {
      ...body,
      projectId,
      assignedAgentId,
      implementerAgentId: null,
    };

    const task = await projectsDb.createTask(createPayload);
    await fastify.finalizeIdempotency(request, 201, task);

    if (task.assignedAgentId) {
      await logFleetTaskActivity(task.assignedAgentId, {
        type: 'task_created',
        description: `Task "${task.title}" created in ${project.name}`,
        metadata: taskActivityMeta({ ...task, projectName: project.name }),
      });
      await notifyAssignedAgent(task.id, task.assignedAgentId, request.log);
    }

    if (
      (await projectsDb.projectTasksAllInReview(task.projectId)) &&
      task.status === 'review'
    ) {
      const qa = await pickAgentByOrgRoleLeastLoaded('qa');
      if (qa?.id) {
        await notifyQaBatchWhenAllTasksInReview(task.id, qa.id, request.log);
      }
    }

    return reply.code(201).send(task);
  });

  fastify.patch('/:taskId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { projectId, taskId } = request.params as { projectId: string; taskId: string };
    assertProjectTaskParams(projectId, taskId);
    const body = parseBody(updateTaskSchema, request.body);

    const existing = await projectsDb.getTask(taskId);
    if (!existing || existing.projectId !== projectId) throw new ApiError(404, 'NOT_FOUND', 'Not found');

    const project = await projectsDb.getProject(projectId);
    if (!project) throw new ApiError(404, 'NOT_FOUND', 'Not found');

    if (
      body.status === 'review' &&
      existing.status !== 'review' &&
      !project.url?.trim()
    ) {
      throw new ApiError(
        409,
        'CONFLICT',
        'Project must have a URL before tasks can move to review',
        { reason: 'project_url_required_for_review' },
      );
    }

    const explicitAssignee = 'assignedAgentId' in body;

    let updateData = { ...body } as Parameters<typeof projectsDb.updateTask>[1];

    if (body.status === 'review' && existing.status !== 'review' && !explicitAssignee) {
      const implementer =
        existing.status === 'doing' && existing.assignedAgentId
          ? existing.assignedAgentId
          : null;
      const engineer = await pickAgentByOrgRoleLeastLoaded('engineer');
      updateData = {
        ...updateData,
        assignedAgentId: engineer?.id ?? null,
        implementerAgentId: implementer,
      };
    }

    if (body.status === 'review' && existing.status !== 'review' && explicitAssignee) {
      const implementer =
        existing.status === 'doing' && existing.assignedAgentId
          ? existing.assignedAgentId
          : null;
      updateData = {
        ...updateData,
        implementerAgentId: implementer,
      };
    }

    if (
      existing.status === 'review' &&
      (body.status === 'backlog' || body.status === 'not_done')
    ) {
      updateData = {
        ...updateData,
        assignedAgentId: existing.implementerAgentId ?? null,
      };
    }

    if (existing.status === 'review' && body.status === 'done') {
      updateData = {
        ...updateData,
        assignedAgentId: null,
        implementerAgentId: null,
      };
    }

    if (updateData.assignedAgentId) {
      const agent = await agentsDb.getAgent(updateData.assignedAgentId);
      if (!agent) {
        throw new ApiError(400, 'BAD_REQUEST', 'Unknown assignedAgentId');
      }
    }

    const task = await projectsDb.updateTask(taskId, updateData);
    if (!task) throw new ApiError(404, 'NOT_FOUND', 'Not found');

    const projectName = project.name;
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

    if (
      task.assignedAgentId &&
      existing.assignedAgentId !== task.assignedAgentId
    ) {
      await notifyAssignedAgent(taskId, task.assignedAgentId, request.log);
    }

    const enteringReview = body.status === 'review' && existing.status !== 'review';

    // if (enteringReview && task.assignedAgentId) {
    //   await notifyAssignedAgent(taskId, task.assignedAgentId, request.log);
    // } else if (
    //   task.assignedAgentId &&
    //   existing.assignedAgentId !== task.assignedAgentId
    // ) {
    //   await notifyAssignedAgent(taskId, task.assignedAgentId, request.log);
    // }

    if (
      (await projectsDb.projectTasksAllInReview(task.projectId)) &&
      enteringReview
    ) {
      const qa = await pickAgentByOrgRoleLeastLoaded('qa');
      if (qa?.id) {
        await notifyQaBatchWhenAllTasksInReview(taskId, qa.id, request.log);
      }
    }

    const transitionedReviewToDone = existing.status === 'review' && task.status === 'done';
    if (transitionedReviewToDone) {
      notifyChiefOfStaffOfReviewCompleted(task, project, request.log).catch((err) =>
        request.log.error({ err }, 'Failed to POST review.completed to Chief of Staff webhook'),
      );
    }

    const transitionedToDone = existing.status !== 'done' && task.status === 'done';
    if (
      transitionedToDone &&
      (await projectsDb.projectTasksAllDone(task.projectId))
    ) {
      notifyChiefOfStaffOfProjectCompleted(project, request.log).catch((err) =>
        request.log.error({ err }, 'Failed to POST project.completed to agent webhook'),
      );
      const discord = getDiscordSyncService();
      const channelId = await resolveGeneralDiscordChannelId(discord, request.log);
      const taskList = await projectsDb.listTasks(task.projectId);
      const discordBody = formatDiscordProjectSuccess(project, taskList);
      await sendDiscordToGeneral(discord, channelId, discordBody, request.log);
    }

    const transitionedToNotDone = existing.status !== 'not_done' && task.status === 'not_done';
    if (
      transitionedToNotDone &&
      (await projectsDb.projectTasksAllNotDone(task.projectId))
    ) {
      const discord = getDiscordSyncService();
      const channelId = await resolveGeneralDiscordChannelId(discord, request.log);
      const taskList = await projectsDb.listTasks(task.projectId);
      const discordBody = formatDiscordProjectFailure(project, taskList);
      await sendDiscordToGeneral(discord, channelId, discordBody, request.log);
    }

    return task;
  });

  fastify.delete('/:taskId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { projectId, taskId } = request.params as { projectId: string; taskId: string };
    assertProjectTaskParams(projectId, taskId);
    const existing = await projectsDb.getTask(taskId);
    if (!existing || existing.projectId !== projectId) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    if (existing.assignedAgentId) {
      const project = await projectsDb.getProject(existing.projectId);
      const projectName = project?.name ?? 'Project';
      await logFleetTaskActivity(existing.assignedAgentId, {
        type: 'task_deleted',
        description: `Task "${existing.title}" removed from ${projectName}`,
        metadata: taskActivityMeta({ ...existing, projectName }),
      });
    }
    await projectsDb.deleteTask(taskId);
    return reply.code(204).send();
  });
};

export default taskRoutes;
