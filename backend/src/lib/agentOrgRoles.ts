/** Align with `AgentOrgRole` in `@mission-control/types` (defined here for backend tsc rootDir). */
export type AgentOrgRole = 'chief_of_staff' | 'engineer' | 'qa';

export const SHARED_AGENT_INSTRUCTION_ORG_ROLES: readonly AgentOrgRole[] = ['engineer', 'qa'];

/**
 * Auto-assignment order for new registrations: CoS → Engineer → QA → Engineer (repeat).
 * `existingAgentCount` is how many agents exist before the new row is inserted.
 */
export function defaultOrgRoleForRegistration(existingAgentCount: number): AgentOrgRole {
  if (existingAgentCount === 0) return 'chief_of_staff';
  if (existingAgentCount === 1) return 'engineer';
  if (existingAgentCount === 2) return 'qa';
  return 'engineer';
}
