import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiPost, apiPatch } from '../client.js';
import { omitNullValues } from './sanitize.js';
import type { Project, Task } from '@mission-control/types';

export function registerProjectTools(server: McpServer) {
  server.tool(
    'list_projects',
    'List all projects.\n\nNo inputs.',
    {},
    async () => {
    const projects = await apiGet<Project[]>('/api/projects');
    return {
      content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }],
    };
    },
  );

  server.tool(
    'list_tasks',
    'List all tasks for a project, grouped by status.\n\nRequired: `projectId`.',
    {
      projectId: z.string().describe('Project UUID (required).'),
    },
    async ({ projectId }) => {
      const tasks = await apiGet<Task[]>(`/api/projects/${projectId}/tasks`);
      const grouped = {
        backlog: tasks.filter((t) => t.status === 'backlog'),
        doing: tasks.filter((t) => t.status === 'doing'),
        review: tasks.filter((t) => t.status === 'review'),
        done: tasks.filter((t) => t.status === 'done'),
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(grouped, null, 2) }],
      };
    },
  );

  server.tool(
    'create_task',
    'Create a new task in a project.\n\nRequired: `projectId`, `title`.\nOptional: `description`, `status` (default: backlog), `assignedAgentId`.',
    {
      projectId: z.string().describe('Project UUID (required).'),
      title: z.string().describe('Task title (required).'),
      description: z
        .string()
        .optional()
        .describe('Optional longer description (omit if not needed).'),
      status: z
        .enum(['backlog', 'doing', 'review', 'done'])
        .optional()
        .describe('Initial status (default: backlog).'),
      assignedAgentId: z
        .string()
        .optional()
        .describe('Agent UUID to assign (omit to leave unassigned).'),
    },
    async ({ projectId, title, description, status, assignedAgentId }) => {
      const task = await apiPost<Task>(
        '/api/tasks',
        omitNullValues({ projectId, title, description, status, assignedAgentId }),
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
      };
    },
  );

  server.tool(
    'update_task',
    'Update a task.\n\nRequired: `taskId`.\nOptional: `status`, `title`, `description`, `assignedAgentId`.\nIf `assignedAgentId` is set to `null`, the task is unassigned.',
    {
      taskId: z.string().describe('Task UUID (required).'),
      status: z.enum(['backlog', 'doing', 'review', 'done']).optional(),
      title: z.string().optional().describe('Updated task title (omit to keep unchanged).'),
      description: z
        .string()
        .optional()
        .describe('Updated description (omit to keep unchanged).'),
      assignedAgentId: z
        .string()
        .nullable()
        .optional()
        .describe('Set to agent UUID to assign, or `null` to unassign (omit to keep unchanged).'),
    },
    async ({ taskId, ...updates }) => {
      const task = await apiPatch<Task>(`/api/tasks/${taskId}`, omitNullValues(updates));
      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
      };
    },
  );
}
