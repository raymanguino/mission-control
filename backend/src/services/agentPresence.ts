import * as agentsDb from '../db/api/agents.js';
import * as settingsDb from '../db/api/settings.js';
import {
  AGENT_PRESENCE_DEFAULTS,
  AGENT_PRESENCE_LEGACY_MCP_STALE_KEY,
  AGENT_PRESENCE_SETTING_KEYS,
  parsePositiveIntMinutes,
} from '../lib/agentPresenceConfig.js';
import { computeAgentPresenceStatus } from '../lib/agentPresenceStatus.js';

export { computeAgentPresenceStatus } from '../lib/agentPresenceStatus.js';
export type { AgentPresenceStatus } from '../lib/agentPresenceStatus.js';

export async function sweepAgentPresence(): Promise<{
  updated: number;
  activityStaleToIdleMinutes: number;
  idleToOfflineMinutes: number;
}> {
  const primaryStale = await settingsDb.getSetting(
    AGENT_PRESENCE_SETTING_KEYS.activityStaleToIdleMinutes,
  );
  const legacyStale = await settingsDb.getSetting(AGENT_PRESENCE_LEGACY_MCP_STALE_KEY);
  const activityStaleToIdleMinutes = parsePositiveIntMinutes(
    primaryStale ?? legacyStale,
    AGENT_PRESENCE_DEFAULTS.activityStaleToIdleMinutes,
  );
  const idleToOfflineMinutes = parsePositiveIntMinutes(
    await settingsDb.getSetting(AGENT_PRESENCE_SETTING_KEYS.idleToOfflineMinutes),
    AGENT_PRESENCE_DEFAULTS.idleToOfflineMinutes,
  );

  const now = new Date();
  const agents = await agentsDb.listAgents();
  let updated = 0;

  for (const agent of agents) {
    const next = computeAgentPresenceStatus({
      now,
      lastActivityAt: agent.lastActivityAt,
      activityStaleToIdleMinutes,
      idleToOfflineMinutes,
    });
    if (agent.status !== next) {
      await agentsDb.updateAgent(agent.id, { status: next });
      updated += 1;
    }
  }

  return {
    updated,
    activityStaleToIdleMinutes,
    idleToOfflineMinutes,
  };
}
