import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { AGENT_AVATAR_IDS } from '@mission-control/types';
import { apiDelete, apiGet, apiPatch, apiPost } from '../client.js';
import { omitNullValues } from './sanitize.js';
import type { Agent, AgentActivity } from '@mission-control/types';

const agentAvatarIdSchema = z
  .enum(AGENT_AVATAR_IDS as unknown as [string, ...string[]])
  .nullable()
  .optional();

export function registerAgentTools(server: McpServer) {
  server.tool(
    'list_agents',
    'List all registered agents with their status, specialization, and last seen time.\n\nNo inputs.',
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
    'Register a new agent.\n\nRequired: `name`.\nOptional: `email`, `specialization`, `description`, `device`, `model`, `reportsToAgentId`.\nOutbound webhooks to OpenClaw use `MC_WEBHOOK_BASE_URL` and `MC_WEBHOOK_TOKEN` on the Mission Control server (not per-agent).\nOrg roles are assigned automatically in order: 1st registration → Chief of Staff, 2nd → Engineer, 3rd → QA, further registrations → Engineer.\nReturns the agent record, a one-time plaintext API key, and role-based instructions.',
    {
      name: z.string().describe('Display name for the agent (required).'),
      email: z.string().optional().describe('Email address for task notifications (optional).'),
      specialization: z.string().optional().describe('Short summary of strongest area, e.g. "Frontend React Developer" (optional).'),
      description: z.string().optional().describe('Detailed skills profile (optional).'),
      device: z.string().optional().describe('Hardware description (optional), e.g. "Raspberry Pi 4".'),
      model: z.string().optional().describe('LLM or runtime model identifier (optional), e.g. "claude-3-5-sonnet".'),
      reportsToAgentId: z.string().optional().describe('Manager agent UUID (optional).'),
    },
    async ({ name, email, specialization, description, device, model, reportsToAgentId }) => {
      const agent = await apiPost<Agent & { apiKey: string; instructions: string | null }>(
        '/api/agents',
        omitNullValues({
          name,
          email,
          specialization,
          description,
          device,
          model,
          reportsToAgentId,
        }),
      );
      return {
        content: [
          {
            type: 'text',
            text: `Agent created. Store the API key and read the instructions carefully — the API key won't be shown again.\n\n${JSON.stringify(agent, null, 2)}`,
          },
        ],
      };
    },
  );

  server.tool(
    'update_agent',
    'Update an existing agent\'s profile.\n\nRequired: `agentId`.\nOptional: `name`, `email`, `specialization`, `description`, `device`, `model`, `orgRole`, `reportsToAgentId`, `avatarId` (preset block-style sprite).',
    {
      agentId: z.string().describe('Agent UUID (required).'),
      name: z.string().optional().describe('Updated display name (omit to keep unchanged).'),
      email: z.string().optional().describe('Updated email address (omit to keep unchanged).'),
      specialization: z.string().optional().describe('Updated specialization summary (omit to keep unchanged).'),
      description: z.string().optional().describe('Updated skills description (omit to keep unchanged).'),
      device: z.string().optional().describe('Updated hardware description (omit to keep unchanged).'),
      model: z.string().optional().describe('Updated LLM or runtime model identifier (omit to keep unchanged).'),
      orgRole: z
        .enum(['chief_of_staff', 'engineer', 'qa'])
        .optional()
        .describe('Override org role (omit to keep unchanged).'),
      reportsToAgentId: z
        .string()
        .nullable()
        .optional()
        .describe('Set to agent UUID to set manager, or null to clear (omit to keep unchanged).'),
      avatarId: agentAvatarIdSchema.describe(
        'Preset avatar id (grass_block, creeper_face, etc.), or null to clear to default (omit to keep unchanged).',
      ),
    },
    async ({ agentId, ...updates }) => {
      const body: Record<string, unknown> = { ...omitNullValues(updates) };
      const agent = await apiPatch<Agent>(`/api/agents/${agentId}`, body);
      return {
        content: [{ type: 'text', text: JSON.stringify(agent, null, 2) }],
      };
    },
  );

  server.tool(
    'delete_agent',
    'Permanently remove an agent registration.\n\nRequired: `agentId`.',
    {
      agentId: z.string().uuid().describe('Agent UUID (required).'),
    },
    async ({ agentId }) => {
      await apiDelete(`/api/agents/${agentId}`);
      return {
        content: [{ type: 'text', text: `Agent deleted (id: ${agentId}).` }],
      };
    },
  );
}
