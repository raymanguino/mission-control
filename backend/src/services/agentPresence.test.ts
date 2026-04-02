import { describe, expect, it } from 'vitest';
import { computeAgentPresenceStatus } from '../lib/agentPresenceStatus.js';

const now = new Date('2026-04-02T12:00:00.000Z');

describe('computeAgentPresenceStatus', () => {
  it('is offline when there is no recorded activity', () => {
    expect(
      computeAgentPresenceStatus({
        now,
        lastActivityAt: null,
        activityStaleToIdleMinutes: 10,
        idleToOfflineMinutes: 10,
      }),
    ).toBe('offline');
  });

  it('is offline when activity is older than T1 + T2', () => {
    expect(
      computeAgentPresenceStatus({
        now,
        lastActivityAt: new Date('2026-04-02T11:20:00.000Z'),
        activityStaleToIdleMinutes: 10,
        idleToOfflineMinutes: 10,
      }),
    ).toBe('offline');
  });

  it('is idle when activity gap is between T1 and T1+T2', () => {
    expect(
      computeAgentPresenceStatus({
        now,
        lastActivityAt: new Date('2026-04-02T11:40:00.000Z'),
        activityStaleToIdleMinutes: 10,
        idleToOfflineMinutes: 10,
      }),
    ).toBe('idle');
  });

  it('is online when activity is within T1', () => {
    expect(
      computeAgentPresenceStatus({
        now,
        lastActivityAt: new Date('2026-04-02T11:55:00.000Z'),
        activityStaleToIdleMinutes: 10,
        idleToOfflineMinutes: 10,
      }),
    ).toBe('online');
  });
});
