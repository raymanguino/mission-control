import {
  ChannelType,
  Client,
  Constants,
  DiscordAPIError,
  Events,
  GatewayIntentBits,
  MessageType,
  type Message,
} from 'discord.js';

const DISCORD_SOURCE = 'discord';
const MAX_SEND_RETRIES = 3;
// discord.js v14 targets Discord API v10 by default.

type Logger = {
  info: (data: Record<string, unknown>, message?: string) => void;
  warn: (data: Record<string, unknown>, message?: string) => void;
  error: (data: Record<string, unknown>, message?: string) => void;
};

export interface DiscordSyncDependencies {
  syncExternalChannel: (data: { source: string; externalId: string; name: string }) => Promise<{ id: string }>;
  deleteChannelByExternalId: (source: string, externalId: string) => Promise<void>;
  getMessageByExternalMessageId: (externalMessageId: string) => Promise<{ id: string } | null>;
  createMessage: (data: {
    channelId: string;
    author: string;
    content: string;
    fromMissionControl?: boolean;
    agentId?: string;
    source?: string;
    externalMessageId?: string;
  }) => Promise<{ id: string; inserted: boolean }>;
}

export interface DiscordChannelEvent {
  id: string;
  name?: string;
  type?: number;
  guildId?: string | null;
}

export interface DiscordMessageEvent {
  id: string;
  channelId: string;
  guildId?: string | null;
  content: string;
  type?: number;
  author: { username: string; globalName?: string | null; bot?: boolean | null };
  channel: DiscordChannelEvent;
}

export interface DiscordSyncHealth {
  enabled: boolean;
  connected: boolean;
  guildId: string | null;
}

export interface DiscordSyncConfig {
  token?: string;
  guildId?: string;
}

const noopLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

/** Forum/media hosts; not in GuildTextBasedChannelTypes but can carry user messages (see Discord channel resources). */
const EXTRA_TEXT_CAPABLE_CHANNEL_TYPES: number[] = [ChannelType.GuildForum, ChannelType.GuildMedia];

/**
 * Matches discord.js {@link Constants.GuildTextBasedChannelTypes} plus forum/media.
 * Gateway payloads sometimes omit `channel.guildId`; fall back to `message.guildId` (Discord API is eventually consistent).
 */
export function isSupportedGuildTextChannel(channel: { type?: number; guildId?: string | null } | null | undefined) {
  if (!channel) return false;
  if (!channel.guildId) return false;
  if (channel.type === undefined) return false;
  if (Constants.GuildTextBasedChannelTypes.includes(channel.type)) return true;
  return EXTRA_TEXT_CAPABLE_CHANNEL_TYPES.includes(channel.type);
}

/** Resolve guild + channel type when the channel object is partial (missing guildId) but the message is guild-scoped. */
function resolveChannelScopeForIngest(message: {
  guildId?: string | null;
  channel?: { type?: number; guildId?: string | null };
}): { type?: number; guildId: string | null } | null {
  const c = message.channel;
  if (!c) return null;
  const guildId = c.guildId ?? message.guildId ?? null;
  return { type: c.type, guildId };
}

/** Non-system message types (Default, Reply, slash/context commands) plus thread starters and poll result lines. */
function isSupportedInboundMessageType(type: number | undefined) {
  if (type === undefined) return true;
  if (Constants.NonSystemMessageTypes.includes(type)) return true;
  if (type === MessageType.ThreadStarterMessage || type === MessageType.PollResult) return true;
  return false;
}

/** For debug: why a message would not be ingested (null = would ingest if not duplicate). */
export function explainInboundSkipReason(message: {
  guildId?: string | null;
  author?: { bot?: boolean | null };
  type?: number;
  channel?: { type?: number; guildId?: string | null };
}, guildId: string): string | null {
  if (!message.guildId || message.guildId !== guildId) return 'guild_mismatch';
  if (!isSupportedInboundMessageType(message.type)) return `unsupported_message_type:${message.type}`;
  const scope = resolveChannelScopeForIngest(message);
  if (!scope?.guildId || scope.guildId !== guildId) return 'guild_mismatch';
  if (!isSupportedGuildTextChannel(scope)) return `unsupported_channel_type:${scope.type}`;
  return null;
}

export function shouldProcessInboundMessage(message: {
  guildId?: string | null;
  author?: { bot?: boolean | null };
  type?: number;
  channel?: { type?: number; guildId?: string | null };
}, guildId: string) {
  if (!message.guildId || message.guildId !== guildId) return false;
  if (!isSupportedInboundMessageType(message.type)) return false;
  const scope = resolveChannelScopeForIngest(message);
  if (!scope?.guildId || scope.guildId !== guildId) return false;
  return isSupportedGuildTextChannel(scope);
}

export function getDiscordAuthorName(author: { globalName?: string | null; username: string }) {
  return author.globalName ?? author.username;
}

function mapDiscordError(error: unknown) {
  if (error instanceof DiscordAPIError) {
    return {
      code: `DISCORD_${error.code}`,
      message: error.message,
      statusCode: 502,
    };
  }
  const e = asError(error);
  return {
    code: 'DISCORD_REQUEST_FAILED',
    message: e.message,
    statusCode: 502,
  };
}

async function withRetry<T>(fn: () => Promise<T>) {
  let attempt = 0;
  let lastError: unknown;
  while (attempt < MAX_SEND_RETRIES) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= MAX_SEND_RETRIES) break;
      await sleep(200 * (2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

export class DiscordSyncService {
  private readonly token?: string;
  private readonly guildId?: string;
  private readonly logger: Logger;
  private readonly deps: DiscordSyncDependencies;
  private client: Client | null = null;
  private connected = false;
  /** Serializes MessageCreate handling so duplicate gateway deliveries cannot race past getMessageByExternalMessageId. */
  private ingestSequential: Promise<void> = Promise.resolve();

  constructor(config: DiscordSyncConfig, logger: Logger | undefined, deps: DiscordSyncDependencies) {
    this.token = config.token;
    this.guildId = config.guildId;
    this.logger = logger ?? noopLogger;
    this.deps = deps;
  }

  getHealth(): DiscordSyncHealth {
    return {
      enabled: Boolean(this.token && this.guildId),
      connected: this.connected,
      guildId: this.guildId ?? null,
    };
  }

  async start() {
    if (!this.token && !this.guildId) {
      this.logger.info({ discordEnabled: false }, 'Discord sync disabled because token and guild are missing');
      return;
    }
    if (!this.token || !this.guildId) {
      this.logger.warn({ discordEnabled: false }, 'Discord sync disabled because token or guild ID is missing');
      return;
    }
    if (this.client) {
      return;
    }

    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    });

    this.client.on(Events.ClientReady, async () => {
      this.connected = true;
      this.logger.info({ guildId: this.guildId }, 'Discord client connected');
      await this.syncAllChannels();
    });

    this.client.on(Events.MessageCreate, (message) => {
      void this.ingestMessageFromGateway(message);
    });

    this.client.on(Events.ChannelCreate, async (channel) => {
      await this.upsertChannelFromGateway(channel);
    });

    this.client.on(Events.ChannelUpdate, async (_oldChannel, newChannel) => {
      await this.upsertChannelFromGateway(newChannel);
    });

    this.client.on(Events.ChannelDelete, async (channel) => {
      await this.deleteChannelFromGateway(channel);
    });

    this.client.on(Events.Error, (error) => {
      this.logger.error({ error: asError(error).message }, 'Discord client error');
    });

    this.client.on(Events.ShardDisconnect, () => {
      this.connected = false;
    });

    try {
      await this.client.login(this.token);
    } catch (error) {
      const mapped = mapDiscordError(error);
      this.logger.error({ code: mapped.code, error: mapped.message }, 'Discord login failed');
      this.connected = false;
      throw new Error(mapped.message);
    }
  }

  async stop() {
    if (!this.client) return;
    await this.client.destroy();
    this.client = null;
    this.connected = false;
  }

  /**
   * Resolves a guild member's display name for attributing outbound messages.
   * The user must be in the configured guild.
   */
  async resolveAuthorForUserId(discordUserId: string): Promise<string> {
    if (!this.client) {
      throw new Error('Discord sync is not initialized');
    }
    if (!this.guildId) {
      throw new Error('Discord guild is not configured');
    }
    try {
      const guild = await this.client.guilds.fetch(this.guildId);
      const member = await guild.members.fetch(discordUserId);
      return member.displayName;
    } catch (error) {
      const mapped = mapDiscordError(error);
      this.logger.warn(
        { code: mapped.code, message: mapped.message, discordUserId },
        'Discord member resolve failed',
      );
      throw new Error(
        error instanceof DiscordAPIError && error.code === 10007
          ? 'Discord user not found in this guild'
          : mapped.message,
      );
    }
  }

  /**
   * When `prefixMissionControl` is true, prepends an italic line so Discord readers see the message is from Mission Control.
   * Stored DB content should remain the unprefixed text.
   */
  async sendMessage(
    externalChannelId: string,
    content: string,
    options?: { prefixMissionControl?: boolean },
  ) {
    if (!this.client) {
      throw new Error('Discord sync is not initialized');
    }
    const channel = await this.client.channels.fetch(externalChannelId);
    if (!channel) {
      throw new Error('Discord channel not found');
    }
    if (!isSupportedGuildTextChannel(channel)) {
      throw new Error('Discord channel is not a supported text channel');
    }
    if (!('send' in channel) || typeof channel.send !== 'function') {
      throw new Error('Discord channel does not support sending messages');
    }
    const body =
      options?.prefixMissionControl === true
        ? `*Sent via Mission Control*\n\n${content}`
        : content;
    try {
      const sent = await withRetry(() => channel.send({ content: body }).then((message) => ({ id: message.id })));
      return sent.id;
    } catch (error) {
      const mapped = mapDiscordError(error);
      this.logger.warn({ code: mapped.code, message: mapped.message }, 'Discord send failed');
      throw new Error(mapped.message);
    }
  }

  private async syncAllChannels() {
    if (!this.client || !this.guildId) return;
    const guild = await this.client.guilds.fetch(this.guildId);
    const channels = await guild.channels.fetch();
    for (const channel of channels.values()) {
      if (!channel) continue;
      await this.upsertChannelFromGateway(channel);
    }
  }

  async upsertChannelFromGateway(channel: DiscordChannelEvent) {
    if (!this.guildId || channel.guildId !== this.guildId || !isSupportedGuildTextChannel(channel)) {
      return;
    }
    await this.deps.syncExternalChannel({
      source: DISCORD_SOURCE,
      externalId: String(channel.id),
      name: channel.name ?? 'discord-channel',
    });
  }

  async deleteChannelFromGateway(channel: { id: string; guildId?: string | null }) {
    if (!this.guildId || channel.guildId !== this.guildId) return;
    await this.deps.deleteChannelByExternalId(DISCORD_SOURCE, String(channel.id));
  }

  async ingestMessageFromGateway(message: DiscordMessageEvent | Message<boolean>) {
    this.ingestSequential = this.ingestSequential.then(() =>
      this.ingestMessageFromGatewayBody(message).catch((err: unknown) => {
        this.logger.error(
          {
            err: asError(err).message,
            messageId: String(message.id),
            channelId: String(message.channelId),
            author: message.author ? getDiscordAuthorName(message.author) : 'unknown',
          },
          'Discord ingestMessageFromGateway failed',
        );
      }),
    );
    await this.ingestSequential;
  }

  private async ingestMessageFromGatewayBody(message: DiscordMessageEvent | Message<boolean>) {
    if (!this.guildId) return;
    if (!shouldProcessInboundMessage(message, this.guildId)) {
      const reason = explainInboundSkipReason(message, this.guildId);
      this.logger.info(
        { messageId: String(message.id), channelId: String(message.channelId), reason },
        'Discord inbound message skipped',
      );
      return;
    }

    const existingMessage = await this.deps.getMessageByExternalMessageId(String(message.id));
    if (existingMessage) return;

    const channelRecord = await this.deps.syncExternalChannel({
      source: DISCORD_SOURCE,
      externalId: String(message.channelId),
      name: 'name' in message.channel ? String(message.channel.name ?? 'discord-channel') : 'discord-channel',
    });
    if (!channelRecord) return;

    const author = getDiscordAuthorName(message.author);
    await this.deps.createMessage({
      channelId: channelRecord.id,
      author,
      content: message.content,
      source: DISCORD_SOURCE,
      externalMessageId: String(message.id),
    });
    this.logger.info(
      { messageId: String(message.id), channelId: channelRecord.id, author },
      'Discord inbound message ingested',
    );
  }
}

