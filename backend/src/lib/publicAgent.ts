import type { InferSelectModel } from 'drizzle-orm';
import type { agents } from '../db/schema.js';

export type AgentRow = InferSelectModel<typeof agents>;

/** Strips secrets (API key hash) for JSON responses. */
export function toPublicAgent(row: AgentRow) {
  const { apiKeyHash, ...rest } = row;
  return rest;
}
