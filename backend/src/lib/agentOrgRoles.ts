/** Align with `AgentOrgRole` in `@mission-control/types` (defined here for backend tsc rootDir). */
export type AgentOrgRole = 'chief_of_staff' | 'engineer' | 'qa';

/** Settings keys for role-specific playbook text (see Settings page). */
export type InstructionSettingKey = 'cos_instructions' | 'agent_instructions' | 'qa_instructions';

/** Map agent role to which settings row holds their instructions (`GET /api/agents/instructions`). */
export function instructionKeyForOrgRole(orgRole: string): InstructionSettingKey {
  if (orgRole === 'chief_of_staff') return 'cos_instructions';
  if (orgRole === 'qa') return 'qa_instructions';
  return 'agent_instructions';
}

/** Engineer and QA roles (non–Chief of Staff). Kept for callers that need both roles in one list. */
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
