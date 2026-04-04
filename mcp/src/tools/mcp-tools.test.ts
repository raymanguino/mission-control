import { describe, expect, it, vi } from 'vitest';

import { registerAgentTools } from './agents.js';
import { registerChatTools } from './chat.js';
import { registerProjectTools } from './projects.js';
import { registerUsageTools } from './usage.js';
import { registerWellnessTools } from './wellness.js';

import { apiDelete, apiGet, apiPatch, apiPost } from '../client.js';

vi.mock('../client.js', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

type ToolHandler = (args?: unknown) => Promise<unknown>;

function getHandlers(registerFn: (server: unknown) => void) {
  const handlers: Record<string, ToolHandler> = {};
  const server = {
    tool: (_name: string, _desc: string, _schema: unknown, handler: ToolHandler) => {
      handlers[_name] = handler;
    },
  } as unknown;

  registerFn(server);
  return handlers;
}

describe('MCP tool unit tests', () => {
  const apiGetMock = vi.mocked(apiGet, true);
  const apiPostMock = vi.mocked(apiPost, true);
  const apiPatchMock = vi.mocked(apiPatch, true);
  const apiDeleteMock = vi.mocked(apiDelete, true);

  it('registerAgentTools: list_agents wraps /api/agents response', async () => {
    const handlers = getHandlers(registerAgentTools as unknown as (server: unknown) => void);
    const agents = [{ id: 'a1', name: 'Alpha', status: 'online', lastSeen: '2026-03-26T00:00:00Z' }];
    apiGetMock.mockResolvedValueOnce(agents as any);

    const res = await handlers.list_agents();
    expect(apiGetMock).toHaveBeenCalledWith('/api/agents');
    expect(res).toEqual({
      content: [{ type: 'text', text: JSON.stringify(agents, null, 2) }],
    });
  });

  it('registerAgentTools: get_agent_activity calls correct endpoint', async () => {
    const handlers = getHandlers(registerAgentTools as unknown as (server: unknown) => void);
    const activities = [{ id: 'x1', type: 'info', description: 'hello' }];
    apiGetMock.mockResolvedValueOnce({ data: activities } as any);

    const res = await handlers.get_agent_activity({ agentId: 'agent-uuid', limit: 10 });
    expect(apiGetMock).toHaveBeenCalledWith('/api/agents/agent-uuid/activity?limit=10');
    expect(res).toEqual({
      content: [{ type: 'text', text: JSON.stringify(activities, null, 2) }],
    });
  });

  it('registerAgentTools: create_agent posts payload and includes created agent JSON', async () => {
    const handlers = getHandlers(registerAgentTools as unknown as (server: unknown) => void);
    const agent = { id: 'a1', name: 'Alpha', device: 'Pi', ip: '1.2.3.4', apiKey: 'secret-once' };
    apiPostMock.mockResolvedValueOnce(agent as any);

    const res = await handlers.create_agent({
      name: 'Alpha',
      hookUrl: 'https://example.com/hooks/agent',
      hookToken: 'tok',
      device: 'Pi',
      ip: '1.2.3.4',
    });
    expect(apiPostMock).toHaveBeenCalledWith('/api/agents', {
      name: 'Alpha',
      hookUrl: 'https://example.com/hooks/agent',
      hookToken: 'tok',
      device: 'Pi',
      ip: '1.2.3.4',
    });

    const text = (res as any).content[0].text as string;
    expect(text).toContain('Agent created. Store the API key');
    expect(text).toContain(JSON.stringify(agent, null, 2));
  });

  it('registerChatTools: get_messages reverses message order', async () => {
    const handlers = getHandlers(registerChatTools as unknown as (server: unknown) => void);
    const messages = [
      { id: 'm1', author: 'Human', content: 'first', createdAt: 't1' },
      { id: 'm2', author: 'Claude', content: 'second', createdAt: 't2' },
    ];
    apiGetMock.mockResolvedValueOnce(messages as any);

    const res = await handlers.get_messages({ channelId: 'ch-1', limit: 2 });
    expect(apiGetMock).toHaveBeenCalledWith('/api/channels/ch-1/messages?limit=2');

    const ordered = [...messages].reverse();
    const parsed = JSON.parse((res as any).content[0].text as string);
    expect(parsed).toEqual(ordered);
  });

  it('registerProjectTools: list_tasks groups by status', async () => {
    const handlers = getHandlers(registerProjectTools as unknown as (server: unknown) => void);
    const tasks = [
      { id: 't1', status: 'backlog' },
      { id: 't2', status: 'doing' },
      { id: 't3', status: 'doing' },
      { id: 't4', status: 'not_done' },
      { id: 't5', status: 'done' },
    ];
    apiGetMock.mockResolvedValueOnce(tasks as any);

    const res = await handlers.list_tasks({ projectId: 'p1' });
    expect(apiGetMock).toHaveBeenCalledWith('/api/projects/p1/tasks');

    const parsed = JSON.parse((res as any).content[0].text as string);
    expect(parsed).toEqual({
      backlog: [tasks[0]],
      doing: [tasks[1], tasks[2]],
      review: [],
      not_done: [tasks[3]],
      done: [tasks[4]],
    });
  });

  it('registerProjectTools: update_task omits null optional fields', async () => {
    const handlers = getHandlers(registerProjectTools as unknown as (server: unknown) => void);
    const updated = { id: 't1', status: 'backlog', assignedAgentId: null };
    apiPatchMock.mockResolvedValueOnce(updated as any);

    const res = await handlers.update_task({ taskId: 't1', assignedAgentId: null });
    expect(apiPatchMock).toHaveBeenCalledWith('/api/tasks/t1', {});

    const parsed = JSON.parse((res as any).content[0].text as string);
    expect(parsed).toEqual(updated);
  });

  it('registerUsageTools: get_usage computes totals and calls correct /api/usage URL', async () => {
    const handlers = getHandlers(registerUsageTools as unknown as (server: unknown) => void);
    const groups = [
      {
        model: 'm1',
        costUsd: 0.1,
        upstreamInferenceCostUsd: 0.05,
        requestCount: 2,
        tokensIn: 100,
        tokensOut: 50,
        reasoningTokens: 10,
        cachedTokens: 5,
        cacheWriteTokens: 1,
        audioTokens: 0,
      },
      {
        model: 'm2',
        costUsd: 0.2,
        upstreamInferenceCostUsd: 0.1,
        requestCount: 3,
        tokensIn: 200,
        tokensOut: 80,
        reasoningTokens: 20,
        cachedTokens: 10,
        cacheWriteTokens: 2,
        audioTokens: 0,
      },
    ];
    apiGetMock.mockResolvedValueOnce(groups as any);

    const res = await handlers.get_usage({
      groupBy: 'apiKey',
      from: '2026-03-01',
      to: '2026-03-02',
    });

    expect(apiGetMock).toHaveBeenCalledWith('/api/usage?groupBy=apiKey&from=2026-03-01&to=2026-03-02');

    const parsed = JSON.parse((res as any).content[0].text as string) as { totals: any; groups: any[] };
    const expectedTotals = {
      totalCostUsd: groups.reduce((sum, g) => sum + Number(g.costUsd), 0).toFixed(6),
      totalUpstreamInferenceCostUsd: groups.reduce((sum, g) => sum + Number(g.upstreamInferenceCostUsd), 0).toFixed(6),
      totalRequests: groups.reduce((sum, g) => sum + Number(g.requestCount), 0),
      totalTokensIn: groups.reduce((sum, g) => sum + Number(g.tokensIn), 0),
      totalTokensOut: groups.reduce((sum, g) => sum + Number(g.tokensOut), 0),
      totalReasoningTokens: groups.reduce((sum, g) => sum + Number(g.reasoningTokens), 0),
      totalCachedTokens: groups.reduce((sum, g) => sum + Number(g.cachedTokens), 0),
      totalCacheWriteTokens: groups.reduce((sum, g) => sum + Number(g.cacheWriteTokens), 0),
      totalAudioTokens: groups.reduce((sum, g) => sum + Number(g.audioTokens), 0),
    };

    expect(parsed.totals).toEqual(expectedTotals);
    expect(parsed.groups).toEqual(groups);
  });

  it('registerUsageTools: sync_usage returns synced count', async () => {
    const handlers = getHandlers(registerUsageTools as unknown as (server: unknown) => void);
    apiPostMock.mockResolvedValueOnce({ synced: 7 } as any);

    const res = await handlers.sync_usage();
    expect(apiPostMock).toHaveBeenCalledWith('/api/usage/sync');
    expect((res as any).content[0].text).toBe('Synced 7 records from OpenRouter.');
  });

  it('registerWellnessTools: quick_log_food posts to /api/health/food/quick', async () => {
    const handlers = getHandlers(registerWellnessTools as unknown as (server: unknown) => void);
    const log = { id: 'food-quick-1', mealType: 'lunch', description: 'Salad' };
    apiPostMock.mockResolvedValueOnce(log as any);

    const res = await handlers.quick_log_food({ text: 'big salad' });

    expect(apiPostMock).toHaveBeenCalledWith('/api/health/food/quick', { text: 'big salad' });
    const text = (res as { content: { text: string }[] }).content[0].text;
    expect(text).toContain('Food logged (quick).');
    expect(text).toContain(JSON.stringify(log, null, 2));
  });

  it('registerWellnessTools: delete_food_log calls DELETE /api/health/food/:id', async () => {
    const handlers = getHandlers(registerWellnessTools as unknown as (server: unknown) => void);
    const id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    apiDeleteMock.mockResolvedValueOnce(undefined);

    const res = await handlers.delete_food_log({ id });

    expect(apiDeleteMock).toHaveBeenCalledWith(`/api/health/food/${id}`);
    expect((res as { content: { text: string }[] }).content[0].text).toBe(
      `Food log deleted (id: ${id}).`,
    );
  });

  it('registerWellnessTools: log_food auto-estimates nutrition when no nutrition fields provided', async () => {
    const handlers = getHandlers(registerWellnessTools as unknown as (server: unknown) => void);

    const now = new Date('2026-03-26T12:34:56.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const estimate = { provider: 'p', model: 'm', calories: 500, protein: 30, carbs: 60, fat: 20 };
    const logged = { id: 'food1', mealType: 'dinner' };

    apiPostMock.mockResolvedValueOnce(estimate as any); // /api/health/food/estimate
    apiPostMock.mockResolvedValueOnce(logged as any); // /api/health/food

    const res = await handlers.log_food({
      mealType: 'dinner',
      description: 'Chicken salad   ',
    });

    expect(apiPostMock).toHaveBeenNthCalledWith(1, '/api/health/food/estimate', {
      description: 'Chicken salad',
    });

    expect(apiPostMock).toHaveBeenNthCalledWith(2, '/api/health/food', {
      mealType: 'dinner',
      description: 'Chicken salad   ',
      loggedAt: now.toISOString(),
      date: now.toISOString().slice(0, 10),
      calories: 500,
      protein: 30,
      carbs: 60,
      fat: 20,
    });

    const text = (res as any).content[0].text as string;
    expect(text).toContain('Food logged.');
    expect(text).toContain('(nutrition auto-estimated via p/m)');

    vi.useRealTimers();
  });

  it('registerWellnessTools: log_food calories schema accepts 0', () => {
    let logFoodSchema: Record<string, { safeParse: (input: unknown) => { success: boolean } }> | null =
      null;
    const server = {
      tool: (name: string, _desc: string, schema: unknown) => {
        if (name === 'log_food') {
          logFoodSchema = schema as Record<
            string,
            { safeParse: (input: unknown) => { success: boolean } }
          >;
        }
      },
    } as unknown;

    registerWellnessTools(server as never);

    expect(logFoodSchema).toBeTruthy();
    expect(logFoodSchema!['calories'].safeParse(0).success).toBe(true);
    expect(logFoodSchema!['calories'].safeParse(-1).success).toBe(false);
  });

  it('registerWellnessTools: log_cannabis_session defaults sessionAt/date and omits null optional fields', async () => {
    const handlers = getHandlers(registerWellnessTools as unknown as (server: unknown) => void);

    const now = new Date('2026-03-26T12:34:56.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const session = { id: 'sess1', form: 'flower' };
    apiPostMock.mockResolvedValueOnce(session as any);

    const res = await handlers.log_cannabis_session({ form: 'flower' });

    expect(apiPostMock).toHaveBeenCalledWith('/api/health/marijuana', {
      form: 'flower',
      sessionAt: now.toISOString(),
      date: now.toISOString().slice(0, 10),
    });

    const parsed = JSON.parse((res as any).content[0].text.replace('Session logged.\n\n', ''));
    expect(parsed).toEqual(session);

    vi.useRealTimers();
  });
});

