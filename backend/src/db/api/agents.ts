import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { db } from '../index.js';
import { agents, agentActivities } from '../schema.js';

export async function getCoSAgents() {
  return db.select().from(agents).where(eq(agents.orgRole, 'chief_of_staff'));
}

export async function listAgentsWithEmailByOrgRole(orgRole: 'chief_of_staff' | 'member') {
  return db
    .select()
    .from(agents)
    .where(and(eq(agents.orgRole, orgRole), isNotNull(agents.email)));
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
  email?: string;
  device?: string;
  ip?: string;
  orgRole?: string;
  specialization?: string;
  description?: string;
  reportsToAgentId?: string | null;
  apiKeyHash: string;
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
    lastSeen: Date;
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

export async function insertActivity(data: {
  agentId: string;
  type: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  const rows = await db.insert(agentActivities).values(data).returning();
  return rows[0]!;
}
