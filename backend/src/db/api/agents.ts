import { and, count, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import type { AgentOrgRole } from '../../lib/agentOrgRoles.js';
import { SHARED_AGENT_INSTRUCTION_ORG_ROLES } from '../../lib/agentOrgRoles.js';
import { db } from '../index.js';
import { agents, agentActivities } from '../schema.js';

export async function countAgents(): Promise<number> {
  const [row] = await db.select({ c: count() }).from(agents);
  return Number(row?.c ?? 0);
}

export async function getCoSAgents() {
  return db.select().from(agents).where(eq(agents.orgRole, 'chief_of_staff'));
}

export async function listAgentsWithEmailByOrgRole(orgRole: AgentOrgRole) {
  return db
    .select()
    .from(agents)
    .where(and(eq(agents.orgRole, orgRole), isNotNull(agents.email)));
}

/** All agents with the given org role (same pattern as {@link getCoSAgents}). */
export async function listAgentsByOrgRole(orgRole: AgentOrgRole) {
  return db.select().from(agents).where(eq(agents.orgRole, orgRole));
}

/** Engineers and QA agents (shared `agent_instructions` playbook). */
export async function listAgentsForSharedAgentInstructions() {
  return db
    .select()
    .from(agents)
    .where(inArray(agents.orgRole, [...SHARED_AGENT_INSTRUCTION_ORG_ROLES]));
}

export async function listAgentsWithEmailForSharedAgentInstructions() {
  return db
    .select()
    .from(agents)
    .where(and(inArray(agents.orgRole, [...SHARED_AGENT_INSTRUCTION_ORG_ROLES]), isNotNull(agents.email)));
}

export async function listAgents() {
  return await db.select().from(agents).orderBy(agents.createdAt);
}

export async function getAgent(id: string) {
  const rows = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getAgentByKeyHash(_hash: string) {
  // Used during auth — caller does bcrypt compare
  return db.select().from(agents);
}

export async function createAgent(data: {
  name: string;
  hookUrl: string;
  hookToken: string;
  email?: string;
  device?: string;
  ip?: string;
  orgRole?: string;
  specialization?: string;
  description?: string;
  reportsToAgentId?: string | null;
  apiKeyHash: string;
  avatarId?: string | null;
}) {
  const rows = await db.insert(agents).values(data).returning();
  return rows[0]!;
}

export async function updateAgent(
  id: string,
  data: Partial<{
    name: string;
    email: string;
    device: string;
    ip: string;
    orgRole: string;
    specialization: string;
    description: string;
    reportsToAgentId: string | null;
    avatarId: string | null;
    hookUrl: string | null;
    hookToken: string | null;
    lastSeen: Date;
    lastActivityAt: Date | null;
    status: string;
  }>,
) {
  const rows = await db.update(agents).set(data).where(eq(agents.id, id)).returning();
  return rows[0] ?? null;
}

export async function deleteAgent(id: string) {
  await db.delete(agents).where(eq(agents.id, id));
}

export async function getActivities(agentId: string, limit: number, offset: number) {
  const rows = await db
    .select()
    .from(agentActivities)
    .where(eq(agentActivities.agentId, agentId))
    .orderBy(desc(agentActivities.createdAt))
    .limit(limit)
    .offset(offset);
  return rows;
}

export async function listFleetActivities(limit: number, offset: number) {
  const rows = await db
    .select({
      id: agentActivities.id,
      agentId: agentActivities.agentId,
      type: agentActivities.type,
      description: agentActivities.description,
      metadata: agentActivities.metadata,
      createdAt: agentActivities.createdAt,
      agentName: agents.name,
    })
    .from(agentActivities)
    .innerJoin(agents, eq(agentActivities.agentId, agents.id))
    .orderBy(desc(agentActivities.createdAt))
    .limit(limit)
    .offset(offset);
  return rows;
}

export async function insertActivity(data: {
  agentId: string;
  type: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  const rows = await db.insert(agentActivities).values(data).returning();
  return rows[0]!;
}

/** Call when Mission Control logs presence-relevant activity for an agent (MCP actions, etc.). */
export async function touchLastActivityAt(agentId: string): Promise<void> {
  await updateAgent(agentId, { lastActivityAt: new Date() });
}
