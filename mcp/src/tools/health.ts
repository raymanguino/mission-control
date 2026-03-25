import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
// #region agent log
import { appendFileSync } from 'fs';
const _dbgLog = (data: object) => { try { appendFileSync('C:/Users/mangu/Dev/debug-5f3356.log', JSON.stringify({sessionId:'5f3356',...data,timestamp:Date.now()})+'\n'); } catch {} };
// #endregion
import { apiGet, apiPost } from '../client.js';
import type { HealthGoal, HealthEntry } from '@mission-control/types';

export function registerHealthTools(server: McpServer) {
  server.tool(
    'create_health_goal',
    'Create a new health goal to track (e.g. steps, calories, sleep hours)',
    {
      name: z.string().describe('Display name for the goal'),
      type: z.enum(['diet', 'exercise', 'sleep', 'other']).describe('Category of the goal'),
      target: z.string().describe('Target value to aim for (numeric)'),
      unit: z.string().describe('Unit of measurement e.g. "steps", "kcal", "hours"'),
      frequency: z.enum(['daily', 'weekly']).optional().describe('Tracking frequency (default: daily)'),
    },
    async ({ name, type, target, unit, frequency }) => {
      const goal = await apiPost<HealthGoal>('/api/health/goals', { name, type, target, unit, frequency });
      return {
        content: [{ type: 'text', text: JSON.stringify(goal, null, 2) }],
      };
    },
  );

  server.tool(
    'list_health_goals',
    "List all health goals. Use get_health_entries to see progress toward each goal.",
    {},
    async () => {
      const goals = await apiGet<HealthGoal[]>('/api/health/goals');
      return {
        content: [{ type: 'text', text: JSON.stringify(goals, null, 2) }],
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
    async ({ goalId, from, to }) => {
      const defaultFrom = new Date();
      defaultFrom.setDate(defaultFrom.getDate() - 7);
      const f = from ?? defaultFrom.toISOString().slice(0, 10);
      const t = to ?? new Date().toISOString().slice(0, 10);
      const params = new URLSearchParams({ from: f, to: t });
      if (goalId) params.set('goalId', goalId);
      const entries = await apiGet<HealthEntry[]>(`/api/health/entries?${params}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }],
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
    async ({ goalId, value, date, notes }) => {
      // #region agent log
      const payload = { goalId, value, date: date ?? new Date().toISOString().slice(0, 10), notes };
      _dbgLog({location:'mcp/health.ts:58',message:'log_health_entry sending payload',hypothesisId:'A',runId:'post-fix',data:{payload,types:{goalId:typeof goalId,value:typeof value,date:typeof payload.date,notes:typeof notes}}});
      // #endregion
      const entry = await apiPost<HealthEntry>('/api/health/entries', payload);
      return {
        content: [{ type: 'text', text: JSON.stringify(entry, null, 2) }],
      };
    },
  );
}
