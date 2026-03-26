import { and, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../index.js';
import { usageRecords } from '../schema.js';

export interface UsageRecordInput {
  agentId?: string;
  apiKeyLabel?: string;
  source?: string;
  providerRequestId?: string;
  model?: string;
  requestCount?: number;
  tokensIn?: number;
  tokensOut?: number;
  reasoningTokens?: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
  audioTokens?: number;
  costUsd?: string;
  upstreamInferenceCostUsd?: string;
  recordedAt: Date;
}

export async function listRecords(limit: number, offset: number) {
  return db
    .select()
    .from(usageRecords)
    .orderBy(desc(usageRecords.recordedAt))
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
      requestCount: sql<number>`coalesce(sum(${usageRecords.requestCount}), 0)`,
      costUsd: sql<string>`coalesce(sum(${usageRecords.costUsd}), 0)::text`,
      upstreamInferenceCostUsd:
        sql<string>`coalesce(sum(${usageRecords.upstreamInferenceCostUsd}), 0)::text`,
      tokensIn: sql<number>`coalesce(sum(${usageRecords.tokensIn}), 0)`,
      tokensOut: sql<number>`coalesce(sum(${usageRecords.tokensOut}), 0)`,
      reasoningTokens: sql<number>`coalesce(sum(${usageRecords.reasoningTokens}), 0)`,
      cachedTokens: sql<number>`coalesce(sum(${usageRecords.cachedTokens}), 0)`,
      cacheWriteTokens: sql<number>`coalesce(sum(${usageRecords.cacheWriteTokens}), 0)`,
      audioTokens: sql<number>`coalesce(sum(${usageRecords.audioTokens}), 0)`,
    })
    .from(usageRecords)
    .where(whereClause)
    .groupBy(groupCol);

  return rows;
}

export async function upsertRecord(data: UsageRecordInput) {
  const payload: UsageRecordInput & { source: string } = {
    recordedAt: data.recordedAt,
    source: data.source ?? 'activity',
    ...(data.agentId !== undefined ? { agentId: data.agentId } : {}),
    ...(data.apiKeyLabel !== undefined ? { apiKeyLabel: data.apiKeyLabel } : {}),
    ...(data.providerRequestId !== undefined ? { providerRequestId: data.providerRequestId } : {}),
    ...(data.model !== undefined ? { model: data.model } : {}),
    ...(data.requestCount !== undefined ? { requestCount: data.requestCount } : {}),
    ...(data.tokensIn !== undefined ? { tokensIn: data.tokensIn } : {}),
    ...(data.tokensOut !== undefined ? { tokensOut: data.tokensOut } : {}),
    ...(data.reasoningTokens !== undefined ? { reasoningTokens: data.reasoningTokens } : {}),
    ...(data.cachedTokens !== undefined ? { cachedTokens: data.cachedTokens } : {}),
    ...(data.cacheWriteTokens !== undefined
      ? { cacheWriteTokens: data.cacheWriteTokens }
      : {}),
    ...(data.audioTokens !== undefined ? { audioTokens: data.audioTokens } : {}),
    ...(data.costUsd !== undefined ? { costUsd: data.costUsd } : {}),
    ...(data.upstreamInferenceCostUsd !== undefined
      ? { upstreamInferenceCostUsd: data.upstreamInferenceCostUsd }
      : {}),
  };

  const existing = await db
    .select()
    .from(usageRecords)
    .where(and(...getMatchConditions(payload)))
    .limit(1);

  if (existing.length > 0) {
    const rows = await db
      .update(usageRecords)
      .set(payload)
      .where(eq(usageRecords.id, existing[0]!.id))
      .returning();
    return rows[0]!;
  }

  const rows = await db.insert(usageRecords).values(payload).returning();
  return rows[0]!;
}

function getMatchConditions(data: Omit<UsageRecordInput, 'source'> & { source: string }) {
  if (data.providerRequestId) {
    return [eq(usageRecords.providerRequestId, data.providerRequestId)];
  }

  return [
    eq(usageRecords.source, data.source),
    eq(usageRecords.recordedAt, data.recordedAt),
    data.model ? eq(usageRecords.model, data.model) : sql`true`,
    // Accept exact label match OR null-labeled rows (migrates pre-labeled records on next sync)
    data.apiKeyLabel
      ? or(eq(usageRecords.apiKeyLabel, data.apiKeyLabel), isNull(usageRecords.apiKeyLabel))!
      : sql`true`,
  ];
}
