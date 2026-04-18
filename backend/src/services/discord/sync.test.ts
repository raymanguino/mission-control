import { describe, expect, it, vi } from 'vitest';
import { ChannelType, MessageType } from 'discord-api-types/v10';
import {
  DiscordSyncService,
  getDiscordAuthorName,
  isSupportedGuildTextChannel,
  shouldProcessInboundMessage,
  explainInboundSkipReason,
  type DiscordMessageEvent,
} from './sync.js';

describe('discord sync helpers', () => {
  it('supports discord.js GuildTextBasedChannelTypes (incl. voice & stage chat)', () => {
    expect(isSupportedGuildTextChannel({ type: ChannelType.GuildText, guildId: '1' })).toBe(true);
    expect(isSupportedGuildTextChannel({ type: ChannelType.GuildAnnouncement, guildId: '1' })).toBe(true);
    expect(isSupportedGuildTextChannel({ type: ChannelType.PublicThread, guildId: '1' })).toBe(true);
    expect(isSupportedGuildTextChannel({ type: ChannelType.PrivateThread, guildId: '1' })).toBe(true);
    expect(isSupportedGuildTextChannel({ type: ChannelType.AnnouncementThread, guildId: '1' })).toBe(true);
    expect(isSupportedGuildTextChannel({ type: ChannelType.GuildVoice, guildId: '1' })).toBe(true);
    expect(isSupportedGuildTextChannel({ type: ChannelType.GuildStageVoice, guildId: '1' })).toBe(true);
    expect(isSupportedGuildTextChannel({ type: ChannelType.GuildForum, guildId: '1' })).toBe(true);
    expect(isSupportedGuildTextChannel({ type: ChannelType.GuildMedia, guildId: '1' })).toBe(true);
  });

  it('validates inbound message eligibility', () => {
    const base = {
      guildId: 'guild-1',
      author: { bot: false },
      type: 0,
      channel: { guildId: 'guild-1', type: ChannelType.GuildText },
    };
    expect(shouldProcessInboundMessage(base, 'guild-1')).toBe(true);
    expect(
      shouldProcessInboundMessage(
        { ...base, type: MessageType.Reply, channel: { guildId: 'guild-1', type: ChannelType.GuildText } },
        'guild-1',
      ),
    ).toBe(true);
    expect(
      shouldProcessInboundMessage(
        { ...base, type: MessageType.Reply, channel: { guildId: 'guild-1', type: ChannelType.PublicThread } },
        'guild-1',
      ),
    ).toBe(true);
    expect(
      shouldProcessInboundMessage(
        { ...base, type: MessageType.ChatInputCommand, channel: { guildId: 'guild-1', type: ChannelType.GuildText } },
        'guild-1',
      ),
    ).toBe(true);
    expect(
      shouldProcessInboundMessage(
        {
          ...base,
          type: MessageType.ThreadStarterMessage,
          channel: { guildId: 'guild-1', type: ChannelType.PublicThread },
        },
        'guild-1',
      ),
    ).toBe(true);
    expect(shouldProcessInboundMessage({ ...base, type: MessageType.PollResult }, 'guild-1')).toBe(true);
    expect(
      shouldProcessInboundMessage(
        {
          guildId: 'guild-1',
          author: { bot: false },
          type: 0,
          channel: { type: ChannelType.GuildText },
        },
        'guild-1',
      ),
    ).toBe(true);
    expect(
      shouldProcessInboundMessage(
        { ...base, type: MessageType.ChannelPinnedMessage },
        'guild-1',
      ),
    ).toBe(false);
    expect(explainInboundSkipReason({ ...base, type: MessageType.ChannelPinnedMessage }, 'guild-1')).toContain(
      'unsupported_message_type',
    );
    expect(shouldProcessInboundMessage({ ...base, author: { bot: true } }, 'guild-1')).toBe(true);
    expect(shouldProcessInboundMessage({ ...base, guildId: 'guild-2' }, 'guild-1')).toBe(false);
  });

  it('prefers global display name for author', () => {
    expect(getDiscordAuthorName({ username: 'bot-user', globalName: 'Display Name' })).toBe('Display Name');
    expect(getDiscordAuthorName({ username: 'bot-user', globalName: null })).toBe('bot-user');
  });
});

describe('discord sync ingestion', () => {
  it('upserts channels for supported guild text channels', async () => {
    const deps = {
      syncExternalChannel: vi.fn().mockResolvedValue({ id: 'channel-1' }),
      deleteChannelByExternalId: vi.fn(),
      getMessageByExternalMessageId: vi.fn(),
      createMessage: vi.fn(),
    };
    const service = new DiscordSyncService(
      { token: 'token', guildId: 'guild-1' },
      undefined,
      deps,
    );

    await service.upsertChannelFromGateway({
      id: 'discord-channel',
      name: 'general',
      type: ChannelType.GuildText,
      guildId: 'guild-1',
    });

    expect(deps.syncExternalChannel).toHaveBeenCalledWith({
      source: 'discord',
      externalId: 'discord-channel',
      name: 'general',
    });
  });

  it('deduplicates inbound messages by external message id', async () => {
    const deps = {
      syncExternalChannel: vi.fn().mockResolvedValue({ id: 'channel-1' }),
      deleteChannelByExternalId: vi.fn(),
      getMessageByExternalMessageId: vi.fn().mockResolvedValue({ id: 'existing-message' }),
      createMessage: vi.fn(),
    };
    const service = new DiscordSyncService(
      { token: 'token', guildId: 'guild-1' },
      undefined,
      deps,
    );

    const event: DiscordMessageEvent = {
      id: 'msg-1',
      channelId: 'chan-1',
      guildId: 'guild-1',
      content: 'hello',
      type: 0,
      author: { id: '1487070776476569720', username: 'Alice', globalName: 'Alice', bot: false },
      channel: { id: 'chan-1', guildId: 'guild-1', type: ChannelType.GuildText, name: 'general' },
    };
    await service.ingestMessageFromGateway(event);
    expect(deps.createMessage).not.toHaveBeenCalled();
  });
});

