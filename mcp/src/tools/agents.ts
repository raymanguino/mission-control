import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiPost } from '../client.js';
import type { Agent, AgentActivity } from '@mission-control/types';

export function registerAgentTools(server: McpServer) {
  server.tool('list_agents', 'List all registered OpenClaw agents with their status and last seen time', {}, async () => {
    const agents = await apiGet<Agent[]>('/api/agents');
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(agents, null, 2),
        },
      ],
    };
  });

  server.tool(
    'get_agent_activity',
    'Get the recent activity log for a specific agent',
    {
      agentId: z.string().describe('The agent UUID'),
      limit: z.number().int().min(1).max(100).optional().describe('Number of entries to return (default 20)'),
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
    'Register a new OpenClaw agent. Returns the agent record plus a one-time plaintext API key.',
    {
      name: z.string().describe('Display name for the agent'),
      device: z.string().optional().describe('Hardware description e.g. "Raspberry Pi 4"'),
      ip: z.string().optional().describe('IP address of the device'),
    },
    async ({ name, device, ip }) => {
      const agent = await apiPost<Agent & { apiKey: string }>('/api/agents', { name, device, ip });
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
