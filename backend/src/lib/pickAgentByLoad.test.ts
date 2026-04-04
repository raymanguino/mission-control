import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db/api/agents.js', () => ({
  listAgentsByOrgRole: vi.fn(),
}));

vi.mock('../db/api/projects.js', () => ({
  countNonDoneTasksByAssignedAgentIds: vi.fn(),
}));

import * as agentsDb from '../db/api/agents.js';
import * as projectsDb from '../db/api/projects.js';
import { pickAgentByOrgRoleLeastLoaded } from './pickAgentByLoad.js';

describe('pickAgentByOrgRoleLeastLoaded', () => {
  beforeEach(() => {
    vi.mocked(agentsDb.listAgentsByOrgRole).mockReset();
    vi.mocked(projectsDb.countNonDoneTasksByAssignedAgentIds).mockReset();
  });

  it('returns null when no agents', async () => {
    vi.mocked(agentsDb.listAgentsByOrgRole).mockResolvedValue([]);
    await expect(pickAgentByOrgRoleLeastLoaded('engineer')).resolves.toBeNull();
  });

  it('returns null when requireWebhook filters out all chief_of_staff agents', async () => {
    vi.mocked(agentsDb.listAgentsByOrgRole).mockResolvedValue([
      {
        id: 'a',
        orgRole: 'chief_of_staff',
        hookUrl: null,
        hookToken: null,
      } as Awaited<ReturnType<typeof agentsDb.listAgentsByOrgRole>>[number],
    ]);
    await expect(
      pickAgentByOrgRoleLeastLoaded('chief_of_staff', { requireWebhook: true }),
    ).resolves.toBeNull();
  });

  it('picks the sole least-loaded chief_of_staff with webhook', async () => {
    vi.mocked(agentsDb.listAgentsByOrgRole).mockResolvedValue([
      {
        id: 'cos1',
        orgRole: 'chief_of_staff',
        hookUrl: 'https://example.com/hook',
        hookToken: 'secret',
      } as Awaited<ReturnType<typeof agentsDb.listAgentsByOrgRole>>[number],
    ]);
    vi.mocked(projectsDb.countNonDoneTasksByAssignedAgentIds).mockResolvedValue({ cos1: 2 });
    const r = await pickAgentByOrgRoleLeastLoaded('chief_of_staff', { requireWebhook: true });
    expect(r?.id).toBe('cos1');
  });

  it('considers only agents with webhooks when requireWebhook is true', async () => {
    vi.mocked(agentsDb.listAgentsByOrgRole).mockResolvedValue([
      {
        id: 'a',
        orgRole: 'chief_of_staff',
        hookUrl: 'https://a/hook',
        hookToken: 't',
      } as Awaited<ReturnType<typeof agentsDb.listAgentsByOrgRole>>[number],
      {
        id: 'b',
        orgRole: 'chief_of_staff',
        hookUrl: null,
        hookToken: null,
      } as Awaited<ReturnType<typeof agentsDb.listAgentsByOrgRole>>[number],
    ]);
    vi.mocked(projectsDb.countNonDoneTasksByAssignedAgentIds).mockResolvedValue({ a: 0 });
    const r = await pickAgentByOrgRoleLeastLoaded('chief_of_staff', { requireWebhook: true });
    expect(r?.id).toBe('a');
  });
});
