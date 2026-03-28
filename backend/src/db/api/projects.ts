import { eq } from 'drizzle-orm';
import { db } from '../index.js';
import { projects, tasks } from '../schema.js';

export async function listProjects() {
  return db.select().from(projects).orderBy(projects.createdAt);
}

export async function getProject(id: string) {
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createProject(data: { name: string; description?: string }) {
  const rows = await db.insert(projects).values(data).returning();
  return rows[0]!;
}

export async function updateProject(id: string, data: Partial<{ name: string; description: string }>) {
  const rows = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteProject(id: string) {
  await db.delete(projects).where(eq(projects.id, id));
}

export async function listTasks(projectId: string) {
  return db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(tasks.order);
}

export async function createTask(data: {
  projectId: string;
  title: string;
  description?: string;
  status?: string;
  assignedAgentId?: string;
  order?: number;
}) {
  const rows = await db.insert(tasks).values(data).returning();
  return rows[0]!;
}

export async function updateTask(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    status: string;
    assignedAgentId: string | null;
    order: number;
  }>,
) {
  const rows = await db
    .update(tasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteTask(id: string) {
  await db.delete(tasks).where(eq(tasks.id, id));
}

export async function getTask(id: string) {
  const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return rows[0] ?? null;
}
