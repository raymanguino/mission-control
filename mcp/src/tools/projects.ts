import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiPost, apiPatch } from '../client.js';
import type { Project, Task } from '@mission-control/types';

export function registerProjectTools(server: McpServer) {
  server.tool('list_projects', 'List all projects', {}, async () => {
    const projects = await apiGet<Project[]>('/api/projects');
    return {
      content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }],
    };
  });

  server.tool(
    'list_tasks',
    'List all tasks for a project, grouped by status',
    {
      projectId: z.string().describe('The project UUID'),
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
    'Create a new task in a project',
    {
      projectId: z.string().describe('The project UUID'),
      title: z.string().describe('Task title'),
      description: z.string().optional().describe('Optional longer description'),
      status: z
        .enum(['backlog', 'doing', 'review', 'done'])
        .optional()
        .describe('Initial status (default: backlog)'),
      assignedAgentId: z.string().optional().describe('UUID of the agent to assign'),
    },
    async ({ projectId, title, description, status, assignedAgentId }) => {
      const task = await apiPost<Task>('/api/tasks', {
        projectId,
        title,
        description,
        status,
        assignedAgentId,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
      };
    },
  );

  server.tool(
    'update_task',
    'Update a task — change its status, title, description, or assigned agent',
    {
      taskId: z.string().describe('The task UUID'),
      status: z.enum(['backlog', 'doing', 'review', 'done']).optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      assignedAgentId: z.string().nullable().optional().describe('Set to null to unassign'),
    },
    async ({ taskId, ...updates }) => {
      const task = await apiPatch<Task>(`/api/tasks/${taskId}`, updates);
      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
      };
    },
  );
}
