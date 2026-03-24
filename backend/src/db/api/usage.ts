import { gte, lte, and, eq, sql } from 'drizzle-orm';
import { db } from '../index.js';
import { usageRecords } from '../schema.js';

export async function listRecords(limit: number, offset: number) {
  return db
    .select()
    .from(usageRecords)
    .orderBy(usageRecords.recordedAt)
    .limit(limit)
    .offset(offset);
}

export async function getAggregated(filters: {
  from?: string;
  to?: string;
  groupBy?: 'model' | 'apiKey' | 'agent';
}) {
  const conditions = [];
  if (filters.from) conditions.push(gte(usageRecords.recordedAt, new Date(filters.from)));
  if (filters.to) conditions.push(lte(usageRecords.recordedAt, new Date(filters.to)));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const groupCol =
    filters.groupBy === 'model'
      ? usageRecords.model
      : filters.groupBy === 'apiKey'
        ? usageRecords.apiKeyLabel
        : usageRecords.agentId;

  const rows = await db
    .select({
      key: groupCol,
      costUsd: sql<string>`sum(${usageRecords.costUsd})`,
      tokensIn: sql<number>`sum(${usageRecords.tokensIn})`,
      tokensOut: sql<number>`sum(${usageRecords.tokensOut})`,
    })
    .from(usageRecords)
    .where(whereClause)
    .groupBy(groupCol);

  return rows;
}

export async function upsertRecord(data: {
  agentId?: string;
  apiKeyLabel?: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: string;
  recordedAt: Date;
}) {
  const existing = await db
    .select()
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.recordedAt, data.recordedAt),
        data.model ? eq(usageRecords.model, data.model) : sql`true`,
        data.apiKeyLabel ? eq(usageRecords.apiKeyLabel, data.apiKeyLabel) : sql`true`,
      ),
    )
    .limit(1);

  if (existing.length > 0) return existing[0]!;

  const rows = await db.insert(usageRecords).values(data).returning();
  return rows[0]!;
}
