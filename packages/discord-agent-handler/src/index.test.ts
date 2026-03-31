import { describe, expect, it } from 'vitest';
import { isTrustedWebhook, shouldProcessMessage, webhookPolicyFromEnv } from './index.js';

describe('shouldProcessMessage', () => {
  const clientUserId = 'bot-user-id';

  it('skips true self messages', () => {
    const shouldProcess = shouldProcessMessage(
      { author: { id: clientUserId, bot: true, username: 'Ralph' } },
      { clientUserId },
    );
    expect(shouldProcess).toBe(false);
  });

  it('accepts webhook messages by default', () => {
    const shouldProcess = shouldProcessMessage(
      {
        author: { id: 'webhook-author-id', bot: true, username: 'Mr' },
        webhookId: 'mc-webhook-id',
      },
      { clientUserId },
    );
    expect(shouldProcess).toBe(true);
  });

  it('rejects non-webhook bot messages by default', () => {
    const shouldProcess = shouldProcessMessage(
      { author: { id: 'other-bot-id', bot: true, username: 'Bot2' } },
      { clientUserId },
    );
    expect(shouldProcess).toBe(false);
  });

  it('supports webhook allowlist by id', () => {
    const accepted = shouldProcessMessage(
      {
        author: { id: 'webhook-author-id', bot: true, username: 'Mr' },
        webhookId: 'allowed-webhook',
      },
      {
        clientUserId,
        allowedWebhookIds: ['allowed-webhook'],
      },
    );

    const rejected = shouldProcessMessage(
      {
        author: { id: 'webhook-author-id', bot: true, username: 'Mr' },
        webhookId: 'blocked-webhook',
      },
      {
        clientUserId,
        allowedWebhookIds: ['allowed-webhook'],
      },
    );

    expect(accepted).toBe(true);
    expect(rejected).toBe(false);
  });
});

describe('isTrustedWebhook', () => {
  it('matches username allowlist when provided', () => {
    expect(
      isTrustedWebhook(
        { author: { id: '1', username: 'Mr' }, webhookId: 'abc' },
        { allowedWebhookUsernames: ['Mr'] },
      ),
    ).toBe(true);
  });
});

describe('webhookPolicyFromEnv', () => {
  it('parses csv env values', () => {
    expect(
      webhookPolicyFromEnv({
        ALLOWED_WEBHOOK_IDS: 'a,b , c',
        ALLOWED_WEBHOOK_USERNAMES: 'Mr, MissionControl',
      }),
    ).toEqual({
      allowedWebhookIds: ['a', 'b', 'c'],
      allowedWebhookUsernames: ['Mr', 'MissionControl'],
    });
  });
});
