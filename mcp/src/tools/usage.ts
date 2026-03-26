import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiPost } from '../client.js';
import type { UsageGroup, UsageRecord } from '@mission-control/types';

interface AiConfigResponse {
  providers: {
    openrouter: {
      configured: boolean;
      modelEnv: {
        OPENROUTER_MODEL: string | null;
        OPENROUTER_CHEAP_MODEL: string | null;
        OPENROUTER_BALANCED_MODEL: string | null;
      };
    };
    anthropic: {
      configured: boolean;
      modelEnv: {
        ANTHROPIC_MODEL: string | null;
      };
    };
  };
  availableCandidates: Array<{
    id: string;
    provider: string;
    model: string;
    workloads: string[];
    costTier: string;
    configured: boolean;
  }>;
  workloadSelections: Array<{
    workload: string;
    status: 'ok' | 'error';
    selected: {
      primary: { id: string; provider: string; model: string; costTier: string };
      fallback: { id: string; provider: string; model: string; costTier: string } | null;
    } | null;
    error?: string;
  }>;
}

export function registerUsageTools(server: McpServer) {
  server.tool(
    'get_usage',
    'Get aggregated LLM usage and cost data from OpenRouter.\n\nOptional: `groupBy` (default: model), `from`, `to`.',
    {
      groupBy: z
        .enum(['model', 'apiKey', 'agent'])
        .optional()
        .describe('Group results by: `model`, `apiKey`, or `agent` (default: model).'),
      from: z.string().optional().describe('Start date (YYYY-MM-DD, optional).'),
      to: z.string().optional().describe('End date (YYYY-MM-DD, optional).'),
    },
    async ({ groupBy = 'model', from, to }) => {
      const params = new URLSearchParams({ groupBy });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const groups = await apiGet<UsageGroup[]>(`/api/usage?${params}`);
      const totals = {
        totalCostUsd: groups.reduce((sum, group) => sum + Number(group.costUsd), 0).toFixed(6),
        totalUpstreamInferenceCostUsd: groups
          .reduce((sum, group) => sum + Number(group.upstreamInferenceCostUsd), 0)
          .toFixed(6),
        totalRequests: groups.reduce((sum, group) => sum + Number(group.requestCount), 0),
        totalTokensIn: groups.reduce((sum, group) => sum + Number(group.tokensIn), 0),
        totalTokensOut: groups.reduce((sum, group) => sum + Number(group.tokensOut), 0),
        totalReasoningTokens: groups.reduce((sum, group) => sum + Number(group.reasoningTokens), 0),
        totalCachedTokens: groups.reduce((sum, group) => sum + Number(group.cachedTokens), 0),
        totalCacheWriteTokens: groups.reduce(
          (sum, group) => sum + Number(group.cacheWriteTokens),
          0,
        ),
        totalAudioTokens: groups.reduce((sum, group) => sum + Number(group.audioTokens), 0),
      };
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ totals, groups }, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    'get_usage_records',
    'Get raw LLM usage records (paginated).\n\nOptional: `limit` (default: 20), `offset` (default: 0).',
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Records to return (default: 20; 1-100).'),
      offset: z.number().int().min(0).optional().describe('Pagination offset (default: 0).'),
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
    'get_ai_config',
    'Get AI routing diagnostics and selected model/fallback by workload.\n\nNo inputs.',
    {},
    async () => {
      const config = await apiGet<AiConfigResponse>('/api/usage/ai/config');
      return {
        content: [{ type: 'text', text: JSON.stringify(config, null, 2) }],
      };
    },
  );

  server.tool(
    'sync_usage',
    'Trigger a manual sync of LLM usage data from OpenRouter.\n\nNo inputs.',
    {},
    async () => {
      const result = await apiPost<{ synced: number }>('/api/usage/sync');
      return {
        content: [{ type: 'text', text: `Synced ${result.synced} records from OpenRouter.` }],
      };
    },
  );
}
