/** Stored in `settings` (string values); must match `@mission-control/types` keys. */
export const AGENT_PRESENCE_SETTING_KEYS = {
  activityStaleToIdleMinutes: 'agent_presence_activity_stale_to_idle_minutes',
  idleToOfflineMinutes: 'agent_presence_idle_to_offline_minutes',
} as const;

/** Legacy key (same semantics as activity stale → idle); read as fallback when migrating. */
export const AGENT_PRESENCE_LEGACY_MCP_STALE_KEY = 'agent_presence_mcp_stale_to_idle_minutes';

export const AGENT_PRESENCE_DEFAULTS = {
  activityStaleToIdleMinutes: 10,
  idleToOfflineMinutes: 10,
} as const;

export function parsePositiveIntMinutes(raw: string | null, fallback: number): number {
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 10_080);
}
