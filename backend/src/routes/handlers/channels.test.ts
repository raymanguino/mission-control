import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import channelRoutes from './channels.js';
import * as channelsDb from '../../db/api/channels.js';

vi.mock('../../db/api/channels.js', () => ({
  listChannels: vi.fn(),
  createChannel: vi.fn(),
  deleteChannel: vi.fn(),
  listMessages: vi.fn(),
}));

async function buildApp() {
  const app = Fastify();
  app.decorate('authenticate', async () => undefined);
  app.decorate('authenticateAgent', async () => undefined);
  app.decorate('enforceIdempotency', async () => undefined);
  app.decorate('finalizeIdempotency', async () => undefined);
  await app.register(channelRoutes, { prefix: '/api/channels' });
  return app;
}

describe('channel routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists channel messages via GET', async () => {
    vi.mocked(channelsDb.listMessages).mockResolvedValue([
      {
        id: 'message-1',
        channelId: 'channel-1',
        author: 'system',
        content: 'hello',
        createdAt: new Date(),
      } as never,
    ]);

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/channels/channel-1/messages?limit=20',
      });
      expect(response.statusCode).toBe(200);
      expect(channelsDb.listMessages).toHaveBeenCalledWith('channel-1', 20, undefined);
      expect(response.json()).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it('does not allow posting messages', async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/channels/channel-1/messages',
        payload: { content: 'hello' },
      });
      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
