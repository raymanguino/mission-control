import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const deprecationNotice =
  'Deprecated. Legacy health goal tools are ignored. Use the daily log tools (`log_sleep`, `log_food`, `log_cannabis_session`) and `run_health_analysis` for goal-driven insights.';

export function registerHealthTools(server: McpServer) {
  server.tool(
    'create_health_goal',
    'Deprecated. Inputs are ignored.\n\nUse `run_health_analysis` with a goal string instead.',
    {
      name: z.string().optional().describe('Ignored input (deprecated).'),
      type: z.enum(['diet', 'exercise', 'sleep', 'other']).optional().describe('Ignored input (deprecated).'),
      target: z.string().optional().describe('Ignored input (deprecated).'),
      unit: z.string().optional().describe('Ignored input (deprecated).'),
      frequency: z
        .enum(['daily', 'weekly'])
        .optional()
        .describe('Ignored input (deprecated).'),
    },
    async () => {
      return {
        content: [{ type: 'text', text: deprecationNotice }],
      };
    },
  );

  server.tool(
    'list_health_goals',
    'Deprecated. Inputs are ignored.\n\nUse `run_health_analysis` with a goal string instead.',
    {},
    async () => {
      return {
        content: [{ type: 'text', text: deprecationNotice }],
      };
    },
  );

  server.tool(
    'get_health_entries',
    'Deprecated. Inputs are ignored.\n\nUse daily log tools for sleep/food/cannabis and/or `run_health_analysis`.',
    {
      goalId: z.string().nullish().optional().describe('Ignored (deprecated).'),
      from: z.string().optional().describe('Ignored (deprecated).'),
      to: z.string().optional().describe('Ignored (deprecated).'),
    },
    async () => {
      return {
        content: [{ type: 'text', text: deprecationNotice }],
      };
    },
  );

  server.tool(
    'log_health_entry',
    'Deprecated. Inputs are ignored.\n\nUse `log_sleep`, `log_food`, or `log_cannabis_session` for daily logs instead.',
    {
      goalId: z.string().uuid().optional().describe('Ignored (deprecated).'),
      value: z.string().optional().describe('Ignored (deprecated).'),
      date: z
        .string()
        .optional()
        .describe('Ignored (deprecated).'),
      notes: z.string().optional().describe('Ignored (deprecated).'),
    },
    async () => {
      return {
        content: [{ type: 'text', text: deprecationNotice }],
      };
    },
  );
}
