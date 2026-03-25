import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiPost } from '../client.js';
import type { UsageGroup, UsageRecord } from '@mission-control/types';

export function registerUsageTools(server: McpServer) {
  server.tool(
    'get_usage',
    'Get aggregated LLM usage and cost data from OpenRouter, grouped by model, API key, or agent',
    {
      groupBy: z
        .enum(['model', 'apiKey', 'agent'])
        .optional()
        .describe('How to group results (default: model)'),
      from: z.string().optional().describe('Start date YYYY-MM-DD'),
      to: z.string().optional().describe('End date YYYY-MM-DD'),
    },
    async ({ groupBy = 'model', from, to }) => {
      const params = new URLSearchParams({ groupBy });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const groups = await apiGet<UsageGroup[]>(`/api/usage?${params}`);
      const totalCost = groups.reduce((s, g) => s + Number(g.costUsd), 0);
      const totalTokens =
        groups.reduce((s, g) => s + Number(g.tokensIn), 0) +
        groups.reduce((s, g) => s + Number(g.tokensOut), 0);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { totalCostUsd: totalCost.toFixed(6), totalTokens, groups },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'get_usage_records',
    'Get raw LLM usage records (paginated)',
    {
      limit: z.number().int().min(1).max(100).optional().describe('Records to return (default 20)'),
      offset: z.number().int().min(0).optional().describe('Pagination offset'),
    },
    async ({ limit = 20, offset = 0 }) => {
      const records = await apiGet<UsageRecord[]>(
        `/api/usage/records?limit=${limit}&offset=${offset}`,
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(records, null, 2) }],
      };
    },
  );

  server.tool(
    'sync_usage',
    'Trigger a manual sync of LLM usage data from OpenRouter',
    {},
    async () => {
      const result = await apiPost<{ synced: number }>('/api/usage/sync');
      return {
        content: [{ type: 'text', text: `Synced ${result.synced} records from OpenRouter.` }],
      };
    },
  );
}
