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

  it('picks the sole least-loaded chief_of_staff', async () => {
    vi.mocked(agentsDb.listAgentsByOrgRole).mockResolvedValue([
      {
        id: 'cos1',
        orgRole: 'chief_of_staff',
      } as Awaited<ReturnType<typeof agentsDb.listAgentsByOrgRole>>[number],
    ]);
    vi.mocked(projectsDb.countNonDoneTasksByAssignedAgentIds).mockResolvedValue({ cos1: 2 });
    const r = await pickAgentByOrgRoleLeastLoaded('chief_of_staff');
    expect(r?.id).toBe('cos1');
  });

  it('picks among multiple agents with minimum load', async () => {
    vi.mocked(agentsDb.listAgentsByOrgRole).mockResolvedValue([
      {
        id: 'a',
        orgRole: 'engineer',
      } as Awaited<ReturnType<typeof agentsDb.listAgentsByOrgRole>>[number],
      {
        id: 'b',
        orgRole: 'engineer',
      } as Awaited<ReturnType<typeof agentsDb.listAgentsByOrgRole>>[number],
    ]);
    vi.mocked(projectsDb.countNonDoneTasksByAssignedAgentIds).mockResolvedValue({ a: 1, b: 3 });
    const r = await pickAgentByOrgRoleLeastLoaded('engineer');
    expect(r?.id).toBe('a');
  });
});
