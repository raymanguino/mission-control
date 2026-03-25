import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiPost } from '../client.js';
import type { HealthGoal, HealthEntry } from '@mission-control/types';

export function registerHealthTools(server: McpServer) {
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
    'Log a value against a health goal (e.g. steps walked, calories eaten, hours slept)',
    {
      goalId: z.string().describe('The health goal UUID'),
      value: z.string().describe('The numeric value to log'),
      date: z
        .string()
        .optional()
        .describe('Date YYYY-MM-DD (default: today)'),
      notes: z.string().optional().describe('Optional notes'),
    },
    async ({ goalId, value, date, notes }) => {
      const entry = await apiPost<HealthEntry>('/api/health/entries', {
        goalId,
        value,
        date: date ?? new Date().toISOString().slice(0, 10),
        notes,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(entry, null, 2) }],
      };
    },
  );
}
