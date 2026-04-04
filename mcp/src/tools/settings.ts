import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiPatch } from '../client.js';

export function registerSettingsTools(server: McpServer) {
  server.tool(
    'get_settings',
    'Get all application settings as a key-value object.\n\nNo inputs.',
    {},
    async () => {
      const result = await apiGet<Record<string, string>>('/api/settings');
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.tool(
    'update_settings',
    'Update one or more application settings.\n\nRequired: `updates` (key-value pairs to set, e.g. `{ "cos_instructions": "...", "agent_instructions": "...", "qa_instructions": "..." }`).',
    {
      updates: z
        .record(z.string(), z.string())
        .describe('Settings key-value pairs to update (required).'),
    },
    async ({ updates }) => {
      const sanitized = Object.fromEntries(
        Object.entries(updates).map(([k, v]) => [k, v ?? '']),
      ) as Record<string, string>;
      const result = await apiPatch<Record<string, string>>('/api/settings', sanitized);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
