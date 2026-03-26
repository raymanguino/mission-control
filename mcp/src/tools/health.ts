import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const deprecationNotice =
  'Legacy health goal tools are deprecated. Use daily log tools for sleep/food/cannabis and run_health_analysis with a goal string.';

export function registerHealthTools(server: McpServer) {
  server.tool(
    'create_health_goal',
    'Deprecated. Health goals are now entered in AI Insights at analysis time.',
    {
      name: z.string().describe('Display name for the goal'),
      type: z.enum(['diet', 'exercise', 'sleep', 'other']).describe('Category of the goal'),
      target: z.string().describe('Target value to aim for (numeric)'),
      unit: z.string().describe('Unit of measurement e.g. "steps", "kcal", "hours"'),
      frequency: z.enum(['daily', 'weekly']).optional().describe('Tracking frequency (default: daily)'),
    },
    async () => {
      return {
        content: [{ type: 'text', text: deprecationNotice }],
      };
    },
  );

  server.tool(
    'list_health_goals',
    'Deprecated. Health goals are now entered in AI Insights at analysis time.',
    {},
    async () => {
      return {
        content: [{ type: 'text', text: deprecationNotice }],
      };
    },
  );

  server.tool(
    'get_health_entries',
    'Get health log entries, optionally filtered by goal and date range',
    {
      goalId: z.string().nullish().describe('Filter by goal UUID'),
      from: z.string().optional().describe('Start date YYYY-MM-DD (default: last 7 days)'),
      to: z.string().optional().describe('End date YYYY-MM-DD (default: today)'),
    },
    async () => {
      return {
        content: [{ type: 'text', text: deprecationNotice }],
      };
    },
  );

  server.tool(
    'log_health_entry',
    'Log a value against a health goal (e.g. steps walked, calories eaten, hours slept). IMPORTANT: call list_health_goals first to obtain a real goal UUID — do not guess or fabricate the goalId.',
    {
      goalId: z.string().uuid().describe('The UUID of the health goal — must be a real UUID obtained from list_health_goals, e.g. "a1b2c3d4-e5f6-7890-abcd-ef1234567890"'),
      value: z.string().describe('The numeric value to log as a string, e.g. "10000"'),
      date: z
        .string()
        .optional()
        .describe('Date YYYY-MM-DD (default: today)'),
      notes: z.string().optional().describe('Optional notes'),
    },
    async () => {
      return {
        content: [{ type: 'text', text: deprecationNotice }],
      };
    },
  );
}
