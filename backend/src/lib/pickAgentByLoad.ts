import { randomInt } from 'node:crypto';
import * as agentsDb from '../db/api/agents.js';
import * as projectsDb from '../db/api/projects.js';
import type { AgentOrgRole } from './agentOrgRoles.js';

type RoutableOrgRole = Exclude<AgentOrgRole, 'chief_of_staff'>;

function pickRandom<T>(items: readonly T[]): T | null {
  if (items.length === 0) return null;
  return items[randomInt(items.length)]!;
}

/**
 * Picks an agent with the given org role that has the fewest non-done tasks currently assigned
 * (`assignedAgentId`). Ties break at random.
 */
export async function pickAgentByOrgRoleLeastLoaded(orgRole: RoutableOrgRole) {
  const agents = await agentsDb.listAgentsByOrgRole(orgRole);
  if (agents.length === 0) return null;

  const counts = await projectsDb.countNonDoneTasksByAssignedAgentIds(agents.map((a) => a.id));
  const minCount = Math.min(...agents.map((a) => counts[a.id] ?? 0));
  const candidates = agents.filter((a) => (counts[a.id] ?? 0) === minCount);
  return pickRandom(candidates);
}
