import { eq } from 'drizzle-orm';
import { db } from '../index.js';
import { settings } from '../schema.js';

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(settings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function getSettingRow(
  key: string,
): Promise<{ value: string; updatedAt: Date } | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return { value: row.value, updatedAt: row.updatedAt };
}

export async function upsertSettings(data: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(data)) {
    await db
      .insert(settings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: new Date() },
      });
  }
}
