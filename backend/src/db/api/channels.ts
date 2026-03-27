import { eq, lt, and, desc, sql } from 'drizzle-orm';
import { db } from '../index.js';
import { channels, messages } from '../schema.js';

export async function listChannels() {
  return db.select().from(channels).orderBy(channels.createdAt);
}

export async function createChannel(data: { name: string; source?: string; externalId?: string }) {
  const rows = await db.insert(channels).values(data).returning();
  return rows[0]!;
}

export async function deleteChannel(id: string) {
  await db.delete(channels).where(eq(channels.id, id));
}

export async function getChannelById(id: string) {
  const rows = await db.select().from(channels).where(eq(channels.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getChannelByExternalId(source: string, externalId: string) {
  const rows = await db
    .select()
    .from(channels)
    .where(and(eq(channels.source, source), eq(channels.externalId, externalId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function syncExternalChannel(data: { source: string; externalId: string; name: string }) {
  const existing = await getChannelByExternalId(data.source, data.externalId);
  if (existing) {
    if (existing.name !== data.name) {
      const updatedRows = await db
        .update(channels)
        .set({ name: data.name })
        .where(eq(channels.id, existing.id))
        .returning();
      return updatedRows[0]!;
    }
    return existing;
  }
  const insertedRows = await db
    .insert(channels)
    .values({
      source: data.source,
      externalId: data.externalId,
      name: data.name,
    })
    .returning();
  return insertedRows[0]!;
}

export async function deleteChannelByExternalId(source: string, externalId: string) {
  await db.delete(channels).where(and(eq(channels.source, source), eq(channels.externalId, externalId)));
}

export async function listMessages(channelId: string, limit: number, before?: string) {
  if (before) {
    return db
      .select()
      .from(messages)
      .where(and(eq(messages.channelId, channelId), lt(messages.createdAt, new Date(before))))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }
  return db
    .select()
    .from(messages)
    .where(eq(messages.channelId, channelId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

export async function createMessage(data: {
  channelId: string;
  author: string;
  content: string;
  fromMissionControl?: boolean;
  agentId?: string;
  source?: string;
  externalMessageId?: string;
}) {
  const rows = await db.insert(messages).values(data).returning();
  return rows[0]!;
}

/**
 * Discord gateway ingest: one row per Discord snowflake across processes.
 * Uses `pg_advisory_xact_lock` on the snowflake so parallel handlers / multiple Node
 * processes cannot both pass the pre-insert existence check.
 */
export async function createMessageForDiscordSync(data: {
  channelId: string;
  author: string;
  content: string;
  fromMissionControl?: boolean;
  agentId?: string;
  source?: string;
  externalMessageId?: string;
}): Promise<{ id: string; inserted: boolean }> {
  if (!data.externalMessageId) {
    const row = await createMessage(data);
    return { id: row.id, inserted: true };
  }
  const ext = data.externalMessageId;
  let lockKey: bigint;
  try {
    lockKey = BigInt(ext);
  } catch {
    throw new Error('Invalid externalMessageId for Discord sync');
  }
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);
    const existingRows = await tx
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.externalMessageId, ext))
      .limit(1);
    if (existingRows[0]) {
      return { id: existingRows[0].id, inserted: false };
    }
    const rows = await tx.insert(messages).values(data).returning({ id: messages.id });
    return { id: rows[0]!.id, inserted: true };
  });
}

export async function getMessageByExternalMessageId(externalMessageId: string) {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.externalMessageId, externalMessageId))
    .limit(1);
  return rows[0] ?? null;
}
