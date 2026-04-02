export type AgentPresenceStatus = 'online' | 'idle' | 'offline';

/**
 * Presence from Mission Control activity only (see `agents.last_activity_at`).
 * No heartbeat: agents with no recorded activity are offline.
 */
export function computeAgentPresenceStatus(args: {
  now: Date;
  lastActivityAt: Date | null;
  activityStaleToIdleMinutes: number;
  idleToOfflineMinutes: number;
}): AgentPresenceStatus {
  const { now, lastActivityAt, activityStaleToIdleMinutes, idleToOfflineMinutes } = args;

  const t1Ms = activityStaleToIdleMinutes * 60_000;
  const t2Ms = idleToOfflineMinutes * 60_000;

  if (lastActivityAt == null) {
    return 'offline';
  }

  const gap = now.getTime() - lastActivityAt.getTime();
  if (gap > t1Ms + t2Ms) {
    return 'offline';
  }
  if (gap > t1Ms) {
    return 'idle';
  }
  return 'online';
}
