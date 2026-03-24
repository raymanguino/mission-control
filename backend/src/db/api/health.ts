import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../index.js';
import { healthGoals, healthEntries } from '../schema.js';

export async function listGoals() {
  return db.select().from(healthGoals).orderBy(healthGoals.createdAt);
}

export async function createGoal(data: {
  name: string;
  type: string;
  target: string;
  unit: string;
  frequency?: string;
}) {
  const rows = await db.insert(healthGoals).values(data).returning();
  return rows[0]!;
}

export async function updateGoal(
  id: string,
  data: Partial<{ name: string; type: string; target: string; unit: string; frequency: string }>,
) {
  const rows = await db.update(healthGoals).set(data).where(eq(healthGoals.id, id)).returning();
  return rows[0] ?? null;
}

export async function deleteGoal(id: string) {
  await db.delete(healthGoals).where(eq(healthGoals.id, id));
}

export async function listEntries(filters: { goalId?: string; from?: string; to?: string }) {
  const conditions = [];
  if (filters.goalId) conditions.push(eq(healthEntries.goalId, filters.goalId));
  if (filters.from) conditions.push(gte(healthEntries.date, filters.from));
  if (filters.to) conditions.push(lte(healthEntries.date, filters.to));

  const query = db.select().from(healthEntries).orderBy(healthEntries.date);
  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }
  return query;
}

export async function createEntry(data: {
  goalId: string;
  value: string;
  notes?: string;
  date: string;
}) {
  const rows = await db.insert(healthEntries).values(data).returning();
  return rows[0]!;
}

export async function updateEntry(
  id: string,
  data: Partial<{ value: string; notes: string; date: string }>,
) {
  const rows = await db
    .update(healthEntries)
    .set(data)
    .where(eq(healthEntries.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteEntry(id: string) {
  await db.delete(healthEntries).where(eq(healthEntries.id, id));
}
