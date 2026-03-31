export interface DiscordAuthorLike {
  id: string;
  bot?: boolean | null;
  username?: string | null;
}

export interface DiscordMessageLike {
  author: DiscordAuthorLike;
  webhookId?: string | null;
}

export interface WebhookPolicy {
  allowedWebhookIds?: string[];
  allowedWebhookUsernames?: string[];
}

export interface AgentMessageFilterOptions extends WebhookPolicy {
  clientUserId: string;
  allowWebhookMessages?: boolean;
  ignoreBotMessages?: boolean;
}

function toSet(values?: string[]): Set<string> {
  return new Set((values ?? []).map((value) => value.trim()).filter(Boolean));
}

export function isTrustedWebhook(
  message: DiscordMessageLike,
  policy: WebhookPolicy = {},
): boolean {
  if (!message.webhookId) return false;

  const allowedWebhookIds = toSet(policy.allowedWebhookIds);
  const allowedWebhookUsernames = toSet(policy.allowedWebhookUsernames);

  const hasIdConstraints = allowedWebhookIds.size > 0;
  const hasUsernameConstraints = allowedWebhookUsernames.size > 0;

  if (!hasIdConstraints && !hasUsernameConstraints) {
    return true;
  }

  if (hasIdConstraints && allowedWebhookIds.has(message.webhookId)) {
    return true;
  }

  const username = message.author.username ?? '';
  if (hasUsernameConstraints && allowedWebhookUsernames.has(username)) {
    return true;
  }

  return false;
}

/**
 * Decide whether an agent should process a Discord message.
 * - Always drops true self messages (`author.id === clientUserId`)
 * - Supports webhook allowlists to safely accept Mission Control posts
 * - Keeps default bot filtering for non-webhook bot users
 */
export function shouldProcessMessage(
  message: DiscordMessageLike,
  options: AgentMessageFilterOptions,
): boolean {
  if (message.author.id === options.clientUserId) {
    return false;
  }

  const allowWebhookMessages = options.allowWebhookMessages ?? true;
  const ignoreBotMessages = options.ignoreBotMessages ?? true;

  if (message.webhookId) {
    if (!allowWebhookMessages) return false;
    return isTrustedWebhook(message, options);
  }

  if (ignoreBotMessages && message.author.bot) {
    return false;
  }

  return true;
}

function parseCsv(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export interface WebhookPolicyEnv {
  ALLOWED_WEBHOOK_IDS?: string;
  ALLOWED_WEBHOOK_USERNAMES?: string;
}

export function webhookPolicyFromEnv(env: WebhookPolicyEnv): WebhookPolicy {
  return {
    allowedWebhookIds: parseCsv(env.ALLOWED_WEBHOOK_IDS),
    allowedWebhookUsernames: parseCsv(env.ALLOWED_WEBHOOK_USERNAMES),
  };
}
