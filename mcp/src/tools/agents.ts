import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiPost } from '../client.js';
import type { Agent, AgentActivity } from '@mission-control/types';

export function registerAgentTools(server: McpServer) {
  server.tool(
    'list_agents',
    'List all registered OpenClaw agents with their status and last seen time.\n\nNo inputs.',
    {},
    async () => {
      const agents = await apiGet<Agent[]>('/api/agents');
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(agents, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    'get_agent_activity',
    'Get the recent activity log for a specific agent.\n\nRequired: `agentId`.\nOptional: `limit` (default: 20).',
    {
      agentId: z.string().describe('Agent UUID (required).'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Number of entries to return (default: 20; 1-100).'),
    },
    async ({ agentId, limit = 20 }) => {
      const result = await apiGet<{ data: AgentActivity[] }>(
        `/api/agents/${agentId}/activity?limit=${limit}`,
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
      };
    },
  );

  server.tool(
    'create_agent',
    'Register a new OpenClaw agent.\n\nRequired: `name`.\nOptional: `device`, `ip`, `orgRole`, `strengths`, `reportsToAgentId`.\nReturns the agent record plus a one-time plaintext API key.',
    {
      name: z.string().describe('Display name for the agent (required).'),
      device: z.string().optional().describe('Hardware description (optional), e.g. "Raspberry Pi 4".'),
      ip: z.string().optional().describe('Device IP address (optional).'),
      orgRole: z
        .enum(['chief_of_staff', 'member'])
        .optional()
        .describe('Org role for this agent (default: member).'),
      strengths: z.string().optional().describe('Short strengths profile text (optional).'),
      reportsToAgentId: z.string().optional().describe('Manager agent UUID (optional).'),
    },
    async ({ name, device, ip, orgRole, strengths, reportsToAgentId }) => {
      const agent = await apiPost<Agent & { apiKey: string }>('/api/agents', {
        name,
        device,
        ip,
        orgRole,
        strengths,
        reportsToAgentId,
      });
      return {
        content: [
          {
            type: 'text',
            text: `Agent created. Store the API key now — it won't be shown again.\n\n${JSON.stringify(agent, null, 2)}`,
          },
        ],
      };
    },
  );
}
