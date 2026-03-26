import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { db } from '../index.js';
import { foodLogs, marijuanaSessions, sleepLogs } from '../schema.js';

// ─── Food Logs ────────────────────────────────────────────────────────────────

function toOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeMacroForWrite(value: number | null): string | null {
  if (value == null) return null;
  return String(toOneDecimal(value));
}

function mapFoodLogMacros<T extends { protein: string | number | null; carbs: string | number | null; fat: string | number | null }>(
  row: T,
): Omit<T, 'protein' | 'carbs' | 'fat'> & {
  protein: number | null;
  carbs: number | null;
  fat: number | null;
} {
  return {
    ...row,
    protein: row.protein == null ? null : Number(row.protein),
    carbs: row.carbs == null ? null : Number(row.carbs),
    fat: row.fat == null ? null : Number(row.fat),
  };
}

export async function listFoodLogs(filters: { date?: string; from?: string; to?: string }) {
  const conditions = [];
  if (filters.date) conditions.push(eq(foodLogs.date, filters.date));
  if (filters.from) conditions.push(gte(foodLogs.date, filters.from));
  if (filters.to) conditions.push(lte(foodLogs.date, filters.to));

  const query = db.select().from(foodLogs).orderBy(desc(foodLogs.loggedAt));
  const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query;
  return rows.map(mapFoodLogMacros);
}

export async function createFoodLog(data: {
  mealType: string;
  description: string;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  loggedAt: Date;
  date: string;
  notes?: string | null;
}) {
  const rows = await db
    .insert(foodLogs)
    .values({
      ...data,
      protein: data.protein === undefined ? undefined : normalizeMacroForWrite(data.protein),
      carbs: data.carbs === undefined ? undefined : normalizeMacroForWrite(data.carbs),
      fat: data.fat === undefined ? undefined : normalizeMacroForWrite(data.fat),
    })
    .returning();
  return mapFoodLogMacros(rows[0]!);
}

export async function updateFoodLog(
  id: string,
  data: Partial<{
    mealType: string;
    description: string;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    loggedAt: Date;
    date: string;
    notes: string | null;
  }>,
) {
  const rows = await db
    .update(foodLogs)
    .set({
      ...data,
      protein: data.protein === undefined ? undefined : normalizeMacroForWrite(data.protein),
      carbs: data.carbs === undefined ? undefined : normalizeMacroForWrite(data.carbs),
      fat: data.fat === undefined ? undefined : normalizeMacroForWrite(data.fat),
    })
    .where(eq(foodLogs.id, id))
    .returning();
  return rows[0] ? mapFoodLogMacros(rows[0]) : null;
}

export async function deleteFoodLog(id: string) {
  await db.delete(foodLogs).where(eq(foodLogs.id, id));
}

// ─── Marijuana Sessions ───────────────────────────────────────────────────────

export async function listMarijuanaSessions(filters: {
  date?: string;
  from?: string;
  to?: string;
}) {
  const conditions = [];
  if (filters.date) conditions.push(eq(marijuanaSessions.date, filters.date));
  if (filters.from) conditions.push(gte(marijuanaSessions.date, filters.from));
  if (filters.to) conditions.push(lte(marijuanaSessions.date, filters.to));

  const query = db.select().from(marijuanaSessions).orderBy(marijuanaSessions.sessionAt);
  if (conditions.length > 0) return query.where(and(...conditions));
  return query;
}

export async function createMarijuanaSession(data: {
  form: string;
  strain?: string | null;
  amount?: string | null;
  unit?: string | null;
  notes?: string | null;
  sessionAt: Date;
  date: string;
}) {
  const rows = await db.insert(marijuanaSessions).values(data).returning();
  return rows[0]!;
}

export async function updateMarijuanaSession(
  id: string,
  data: Partial<{
    form: string;
    strain: string | null;
    amount: string | null;
    unit: string | null;
    notes: string | null;
    sessionAt: Date;
    date: string;
  }>,
) {
  const rows = await db
    .update(marijuanaSessions)
    .set(data)
    .where(eq(marijuanaSessions.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteMarijuanaSession(id: string) {
  await db.delete(marijuanaSessions).where(eq(marijuanaSessions.id, id));
}

// ─── Sleep Logs ───────────────────────────────────────────────────────────────

export async function listSleepLogs(filters: { from?: string; to?: string }) {
  const conditions = [];
  if (filters.from) conditions.push(gte(sleepLogs.date, filters.from));
  if (filters.to) conditions.push(lte(sleepLogs.date, filters.to));

  const query = db
    .select()
    .from(sleepLogs)
    .orderBy(desc(sql`coalesce(${sleepLogs.wakeTime}, ${sleepLogs.bedTime})`));
  if (conditions.length > 0) return query.where(and(...conditions));
  return query;
}

export async function createSleepLog(data: {
  bedTime: Date;
  wakeTime?: Date | null;
  qualityScore?: number | null;
  notes?: string | null;
  date: string;
}) {
  const rows = await db.insert(sleepLogs).values(data).returning();
  return rows[0]!;
}

export async function updateSleepLog(
  id: string,
  data: Partial<{
    bedTime: Date;
    wakeTime: Date | null;
    qualityScore: number | null;
    notes: string | null;
    date: string;
  }>,
) {
  const rows = await db.update(sleepLogs).set(data).where(eq(sleepLogs.id, id)).returning();
  return rows[0] ?? null;
}

export async function deleteSleepLog(id: string) {
  await db.delete(sleepLogs).where(eq(sleepLogs.id, id));
}
