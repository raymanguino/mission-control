/** Role suffix for OpenClaw relay `POST /hooks/mc/{role}` (see `packages/agent-webhook-relay`). */

export type McWebhookRole = 'cos' | 'eng' | 'qa';

/**
 * Resolves the webhook URL Mission Control POSTs to for role-based routing.
 * - `https://host/hooks/mc/cos` → same host with `/hooks/mc/{role}`
 * - `https://host` or `https://host/` → `https://host/hooks/mc/{role}`
 * - Other paths (e.g. `/hooks/agent`) → `https://host/hooks/mc/{role}` (single OpenClaw receiver)
 */
export function applyMcRoleToHookUrl(hookUrl: string, role: McWebhookRole): string {
  const trimmed = hookUrl.trim();
  try {
    const u = new URL(trimmed);
    const pathname = u.pathname.replace(/\/$/, '') || '/';
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 3 && segments[0] === 'hooks' && segments[1] === 'mc') {
      u.pathname = `/hooks/mc/${role}`;
    } else if (pathname === '/' || pathname === '') {
      u.pathname = `/hooks/mc/${role}`;
    } else {
      u.pathname = `/hooks/mc/${role}`;
    }
    return u.toString();
  } catch {
    return trimmed;
  }
}
