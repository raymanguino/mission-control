import type { InferSelectModel } from 'drizzle-orm';
import type { agents } from '../db/schema.js';

export type AgentRow = InferSelectModel<typeof agents>;

/** Strips secrets (API key hash, webhook bearer token) for JSON responses. */
export function toPublicAgent(row: AgentRow) {
  const { hookToken, apiKeyHash, ...rest } = row;
  return {
    ...rest,
    hookTokenSet: Boolean(hookToken && hookToken.length > 0),
  };
}
