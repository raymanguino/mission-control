import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import channelRoutes from './channels.js';
import * as channelsDb from '../../db/api/channels.js';
import { getDiscordSyncService } from '../../services/discord/index.js';

vi.mock('../../db/api/channels.js', () => ({
  listChannels: vi.fn(),
  createChannel: vi.fn(),
  deleteChannel: vi.fn(),
  listMessages: vi.fn(),
  createMessage: vi.fn(),
  getChannelById: vi.fn(),
}));

vi.mock('../../services/discord/index.js', () => ({
  getDiscordSyncService: vi.fn(),
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

describe('channel route posting behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores manual channel messages without discord send', async () => {
    vi.mocked(channelsDb.getChannelById).mockResolvedValue({
      id: 'channel-1',
      name: 'manual',
      source: 'manual',
      externalId: null,
      createdAt: new Date(),
    });
    vi.mocked(channelsDb.createMessage).mockResolvedValue({
      id: 'message-1',
      channelId: 'channel-1',
      author: 'user',
      content: 'hello',
      agentId: null,
      fromMissionControl: true,
      source: 'manual',
      externalMessageId: null,
      createdAt: new Date(),
    });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/channels/channel-1/messages',
        payload: { author: 'user', content: 'hello' },
      });
      expect(response.statusCode).toBe(201);
      expect(getDiscordSyncService).not.toHaveBeenCalled();
      expect(channelsDb.createMessage).toHaveBeenCalledWith({
        channelId: 'channel-1',
        author: 'user',
        content: 'hello',
        fromMissionControl: true,
        source: 'manual',
      });
    } finally {
      await app.close();
    }
  });

  it('resolves discordUserId to author when Discord is connected', async () => {
    vi.mocked(channelsDb.getChannelById).mockResolvedValue({
      id: 'channel-1',
      name: 'manual',
      source: 'manual',
      externalId: null,
      createdAt: new Date(),
    });
    const resolveAuthorForUserId = vi.fn().mockResolvedValue('Resolved User');
    vi.mocked(getDiscordSyncService).mockReturnValue({
      resolveAuthorForUserId,
    } as unknown as ReturnType<typeof getDiscordSyncService>);
    vi.mocked(channelsDb.createMessage).mockResolvedValue({
      id: 'message-1',
      channelId: 'channel-1',
      author: 'Resolved User',
      content: 'hello',
      agentId: null,
      fromMissionControl: true,
      source: 'manual',
      externalMessageId: null,
      createdAt: new Date(),
    });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/channels/channel-1/messages',
        payload: { discordUserId: '123456789012345678', content: 'hello' },
      });
      expect(response.statusCode).toBe(201);
      expect(resolveAuthorForUserId).toHaveBeenCalledWith('123456789012345678');
      expect(channelsDb.createMessage).toHaveBeenCalledWith({
        channelId: 'channel-1',
        author: 'Resolved User',
        content: 'hello',
        fromMissionControl: true,
        source: 'manual',
      });
    } finally {
      await app.close();
    }
  });

  it('sends discord channel messages and persists external id', async () => {
    vi.mocked(channelsDb.getChannelById).mockResolvedValue({
      id: 'channel-1',
      name: 'discord-general',
      source: 'discord',
      externalId: 'discord-channel-id',
      createdAt: new Date(),
    });
    const sendMessage = vi.fn().mockResolvedValue('discord-message-id');
    vi.mocked(getDiscordSyncService).mockReturnValue({
      sendMessage,
    } as unknown as ReturnType<typeof getDiscordSyncService>);
    vi.mocked(channelsDb.createMessage).mockResolvedValue({
      id: 'message-1',
      channelId: 'channel-1',
      author: 'user',
      content: 'hello',
      agentId: null,
      fromMissionControl: true,
      source: 'discord',
      externalMessageId: 'discord-message-id',
      createdAt: new Date(),
    });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/channels/channel-1/messages',
        payload: { author: 'user', content: 'hello' },
      });
      expect(response.statusCode).toBe(201);
      expect(sendMessage).toHaveBeenCalledWith('discord-channel-id', 'hello', {
        prefixMissionControl: true,
      });
      expect(channelsDb.createMessage).toHaveBeenCalledWith({
        channelId: 'channel-1',
        author: 'user',
        content: 'hello',
        fromMissionControl: true,
        source: 'discord',
        externalMessageId: 'discord-message-id',
      });
    } finally {
      await app.close();
    }
  });
});

