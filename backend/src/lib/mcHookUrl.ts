/** Role suffix for OpenClaw relay `POST /hooks/mc/{role}` (see `packages/agent-webhook-relay`). */

export type McWebhookRole = 'cos' | 'eng' | 'qa';

/**
 * Builds `{base}/hooks/mc/{role}` for a configured origin (no per-agent URL).
 */
export function buildMcRoleWebhookUrl(baseUrl: string, role: McWebhookRole): string {
  const trimmed = baseUrl.trim().replace(/\/$/, '');
  const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  u.pathname = `/hooks/mc/${role}`;
  return u.toString();
}

/**
 * Resolves Mission Control outbound webhook URL from `MC_WEBHOOK_BASE_URL`.
 * Returns null if unset or invalid.
 */
export function getMcRoleWebhookUrl(role: McWebhookRole): string | null {
  const raw = process.env['MC_WEBHOOK_BASE_URL']?.trim();
  if (!raw) return null;
  try {
    return buildMcRoleWebhookUrl(raw, role);
  } catch {
    return null;
  }
}
