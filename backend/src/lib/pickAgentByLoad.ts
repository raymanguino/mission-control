import { randomInt } from 'node:crypto';
import * as agentsDb from '../db/api/agents.js';
import * as projectsDb from '../db/api/projects.js';
import type { AgentOrgRole } from './agentOrgRoles.js';

function pickRandom<T>(items: readonly T[]): T | null {
  if (items.length === 0) return null;
  return items[randomInt(items.length)]!;
}

export type PickAgentByLoadOptions = {
  /** If true, only agents with both `hookUrl` and `hookToken` are considered (e.g. CoS approval webhooks). */
  requireWebhook?: boolean;
};

/**
 * Picks an agent with the given org role that has the fewest non-done tasks currently assigned
 * (`assignedAgentId`). Ties break at random.
 */
export async function pickAgentByOrgRoleLeastLoaded(
  orgRole: AgentOrgRole,
  options?: PickAgentByLoadOptions,
) {
  let agents = await agentsDb.listAgentsByOrgRole(orgRole);
  if (options?.requireWebhook) {
    agents = agents.filter((a) => a.hookUrl?.trim() && a.hookToken?.trim());
  }
  if (agents.length === 0) return null;

  const counts = await projectsDb.countNonDoneTasksByAssignedAgentIds(agents.map((a) => a.id));
  const minCount = Math.min(...agents.map((a) => counts[a.id] ?? 0));
  const candidates = agents.filter((a) => (counts[a.id] ?? 0) === minCount);
  return pickRandom(candidates);
}
