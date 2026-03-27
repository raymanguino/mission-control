import type { FastifyBaseLogger } from 'fastify';
import { DiscordSyncService } from './sync.js';
import * as channelsDb from '../../db/api/channels.js';

let discordSyncService: DiscordSyncService | null = null;

export async function startDiscordSync(logger: FastifyBaseLogger) {
  if (discordSyncService) return discordSyncService;
  discordSyncService = new DiscordSyncService(
    {
      token: process.env['DISCORD_BOT_TOKEN'],
      guildId: process.env['DISCORD_GUILD_ID'],
    },
    logger,
    {
      syncExternalChannel: channelsDb.syncExternalChannel,
      deleteChannelByExternalId: channelsDb.deleteChannelByExternalId,
      getMessageByExternalMessageId: channelsDb.getMessageByExternalMessageId,
      createMessage: channelsDb.createMessageForDiscordSync,
    },
  );
  await discordSyncService.start();
  return discordSyncService;
}

export async function stopDiscordSync() {
  if (!discordSyncService) return;
  await discordSyncService.stop();
  discordSyncService = null;
}

export function getDiscordSyncService() {
  return discordSyncService;
}

