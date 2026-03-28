import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiPatch, apiPost } from '../client.js';
import { omitNullValues } from './sanitize.js';
import type { Intent, Project } from '@mission-control/types';

export function registerIntentTools(server: McpServer) {
  server.tool(
    'get_intent',
    'Get a single intent by ID.\n\nRequired: `intentId`.',
    {
      intentId: z.string().describe('Intent UUID (required).'),
    },
    async ({ intentId }) => {
      const intent = await apiGet<Intent>(`/api/intents/${intentId}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(intent, null, 2) }],
      };
    },
  );

  server.tool(
    'list_intents',
    'List all intents.\n\nNo inputs.',
    {},
    async () => {
      const intents = await apiGet<Intent[]>('/api/intents');
      return {
        content: [{ type: 'text', text: JSON.stringify(intents, null, 2) }],
      };
    },
  );

  server.tool(
    'create_intent',
    'Create a new intent.\n\nRequired: `title`, `body`.\nOptional: `status`.',
    {
      title: z.string().describe('Intent title (required).'),
      body: z.string().describe('Intent body/details (required).'),
      status: z
        .enum(['open', 'converted', 'cancelled'])
        .optional()
        .describe('Initial status (default: open).'),
    },
    async ({ title, body, status }) => {
      const intent = await apiPost<Intent>('/api/intents', omitNullValues({ title, body, status }));
      return {
        content: [{ type: 'text', text: JSON.stringify(intent, null, 2) }],
      };
    },
  );

  server.tool(
    'update_intent',
    'Update an intent.\n\nRequired: `intentId`.\nOptional: `title`, `body`, `status`, `createdProjectId`.',
    {
      intentId: z.string().describe('Intent UUID (required).'),
      title: z.string().optional().describe('Updated title (omit to keep unchanged).'),
      body: z.string().optional().describe('Updated body (omit to keep unchanged).'),
      status: z.enum(['open', 'converted', 'cancelled']).optional(),
      createdProjectId: z
        .string()
        .nullable()
        .optional()
        .describe('Set to project UUID to link project, or null to clear.'),
    },
    async ({ intentId, ...updates }) => {
      const intent = await apiPatch<Intent>(`/api/intents/${intentId}`, omitNullValues(updates));
      return {
        content: [{ type: 'text', text: JSON.stringify(intent, null, 2) }],
      };
    },
  );

  server.tool(
    'convert_intent_to_project',
    'Convert an intent into a project.\n\nRequired: `intentId`, `projectName`.\nOptional: `projectDescription`.',
    {
      intentId: z.string().describe('Intent UUID (required).'),
      projectName: z.string().describe('Name for the created project (required).'),
      projectDescription: z.string().optional().describe('Optional description for the created project.'),
    },
    async ({ intentId, projectName, projectDescription }) => {
      const result = await apiPost<{ intent: Intent; project: Project }>(
        `/api/intents/${intentId}/convert`,
        omitNullValues({ projectName, projectDescription }),
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
