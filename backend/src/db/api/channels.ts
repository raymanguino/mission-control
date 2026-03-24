import { eq, lt, and, desc } from 'drizzle-orm';
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
  agentId?: string;
}) {
  const rows = await db.insert(messages).values(data).returning();
  return rows[0]!;
}
