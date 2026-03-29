import { desc, eq } from 'drizzle-orm';
import { db } from '../index.js';
import { intents, projects } from '../schema.js';

export async function listIntents() {
  return db.select().from(intents).orderBy(desc(intents.createdAt));
}

export async function getIntent(id: string) {
  const rows = await db.select().from(intents).where(eq(intents.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createIntent(data: { title: string; body: string; status?: string }) {
  const rows = await db.insert(intents).values(data).returning();
  return rows[0]!;
}

export async function updateIntent(
  id: string,
  data: Partial<{ title: string; body: string; status: string; createdProjectId: string | null }>,
) {
  const rows = await db
    .update(intents)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(intents.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteIntent(id: string) {
  await db.delete(intents).where(eq(intents.id, id));
}

export async function convertIntentToProject(
  id: string,
  projectData: { name: string; description?: string },
) {
  return db.transaction(async (tx) => {
    const projectRows = await tx.insert(projects).values(projectData).returning();
    const project = projectRows[0]!;
    const intentRows = await tx
      .update(intents)
      .set({
        status: 'converted',
        createdProjectId: project.id,
        updatedAt: new Date(),
      })
      .where(eq(intents.id, id))
      .returning();
    return {
      intent: intentRows[0] ?? null,
      project,
    };
  });
}
