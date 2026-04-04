import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiDelete, apiGet, apiPost, apiPatch } from '../client.js';
import { omitNullValues } from './sanitize.js';
import type { Project, Task } from '@mission-control/types';

export function registerProjectTools(server: McpServer) {
  server.tool(
    'get_task',
    'Get a single task by ID.\n\nRequired: `taskId`.',
    {
      taskId: z.string().describe('Task UUID (required).'),
    },
    async ({ taskId }) => {
      const task = await apiGet<Task>(`/api/tasks/${taskId}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
      };
    },
  );

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
    'get_project',
    'Get a single project by ID.\n\nRequired: `projectId`.',
    {
      projectId: z.string().uuid().describe('Project UUID (required).'),
    },
    async ({ projectId }) => {
      const project = await apiGet<Project>(`/api/projects/${projectId}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
      };
    },
  );

  server.tool(
    'create_project',
    'Create a new project.\n\nRequired: `name`.\nOptional: `description`, `url`.',
    {
      name: z.string().describe('Project name (required).'),
      description: z
        .string()
        .optional()
        .describe('Optional longer project description (omit if not needed).'),
      url: z
        .string()
        .url()
        .optional()
        .describe('Optional project URL (omit if not needed).'),
    },
    async ({ name, description, url }) => {
      const project = await apiPost<Project>(
        '/api/projects',
        omitNullValues({ name, description, url }),
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
      };
    },
  );

  server.tool(
    'update_project',
    'Update a project name, description, approval status, or URL.\n\nRequired: `projectId`.\nOptional: `name`, `description`, `status` (pending_approval | approved | denied), `url` (omit or set null to clear), `approvedByAgentId` (optional: chief_of_staff agent UUID when approving from the dashboard; omit when using a CoS agent API key — the server records the approver automatically).',
    {
      projectId: z.string().uuid().describe('Project UUID (required).'),
      name: z.string().optional().describe('Updated name (omit to keep unchanged).'),
      description: z.string().optional().describe('Updated description (omit to keep unchanged).'),
      status: z
        .enum(['pending_approval', 'approved', 'denied'])
        .optional()
        .describe('Set to approved or denied to action a pending project.'),
      url: z
        .string()
        .url()
        .nullable()
        .optional()
        .describe('Updated project URL, or null to clear (omit to keep unchanged).'),
      approvedByAgentId: z
        .string()
        .uuid()
        .nullable()
        .optional()
        .describe(
          'When approving with dashboard credentials, set to the chief_of_staff agent id. Omit when calling as CoS (recorded automatically).',
        ),
    },
    async ({ projectId, ...updates }) => {
      const project = await apiPatch<Project>(`/api/projects/${projectId}`, omitNullValues(updates));
      return {
        content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
      };
    },
  );

  server.tool(
    'delete_project',
    'Permanently delete a project and its tasks.\n\nRequired: `projectId`.',
    {
      projectId: z.string().uuid().describe('Project UUID (required).'),
    },
    async ({ projectId }) => {
      await apiDelete(`/api/projects/${projectId}`);
      return {
        content: [{ type: 'text', text: `Project deleted (id: ${projectId}).` }],
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
        not_done: tasks.filter((t) => t.status === 'not_done'),
        done: tasks.filter((t) => t.status === 'done'),
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(grouped, null, 2) }],
      };
    },
  );

  server.tool(
    'create_task',
    'Create a new task in a project. The project must have status `approved` (use update_project first).\n\nRequired: `projectId`, `title`.\nOptional: `description`, `resolution`, `status` (default: backlog).\n\nAssignee is chosen automatically: an engineer with the fewest open (non-done) tasks (random tie-break), or a QA agent if `status` is `review`.',
    {
      projectId: z.string().describe('Project UUID (required).'),
      title: z.string().describe('Task title (required).'),
      description: z
        .string()
        .optional()
        .describe('Optional longer description (omit if not needed).'),
      resolution: z
        .string()
        .optional()
        .describe('Optional resolution / outcome description (omit if not needed).'),
      status: z
        .enum(['backlog', 'doing', 'review', 'not_done', 'done'])
        .optional()
        .describe('Initial status (default: backlog).'),
    },
    async ({ projectId, title, description, resolution, status }) => {
      const task = await apiPost<Task>(
        '/api/tasks',
        omitNullValues({ projectId, title, description, resolution, status }),
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
      };
    },
  );

  server.tool(
    'update_task',
    'Update a task.\n\nRequired: `taskId`.\nOptional: `status`, `title`, `description`, `resolution`, `assignedAgentId`.\nIf `assignedAgentId` is set to `null`, the task is unassigned.',
    {
      taskId: z.string().describe('Task UUID (required).'),
      status: z.enum(['backlog', 'doing', 'review', 'not_done', 'done']).optional(),
      title: z.string().optional().describe('Updated task title (omit to keep unchanged).'),
      description: z
        .string()
        .optional()
        .describe('Updated description (omit to keep unchanged).'),
      resolution: z
        .string()
        .optional()
        .describe('Updated resolution / outcome (omit to keep unchanged).'),
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

  server.tool(
    'delete_task',
    'Permanently delete a task.\n\nRequired: `taskId`.',
    {
      taskId: z.string().uuid().describe('Task UUID (required).'),
    },
    async ({ taskId }) => {
      await apiDelete(`/api/tasks/${taskId}`);
      return {
        content: [{ type: 'text', text: `Task deleted (id: ${taskId}).` }],
      };
    },
  );
}
