import * as agentsDb from '../db/api/agents.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_REGEX.test(s);
}

/** Updates `last_activity_at` for each distinct valid agent id (MCP / presence). */
export async function touchMcpActivity(agentIds: (string | null | undefined)[]): Promise<void> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of agentIds) {
    if (!id || !isUuid(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  await Promise.all(unique.map((id) => agentsDb.touchLastActivityAt(id)));
}
