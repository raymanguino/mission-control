# @mission-control/discord-agent-handler

Shared message handler utilities for Discord-based agents.

Use this package to keep agent filtering behavior consistent:
- Skip true self messages by user ID
- Allow Mission Control webhook messages
- Optionally allowlist trusted webhook IDs/usernames

## What this is for

Use this package only when your agent consumes Discord gateway `messageCreate` events.

- `webhookId` filtering exists because Mission Control may publish into Discord via webhook.
- Those messages are usually bot-like (`author.bot = true`) but should still be processed by agents.
- Self-skip must use stable IDs (`author.id === clientUserId`), not display names.

If your OpenClaw agent reads from Mission Control HTTP/MCP instead of Discord gateway events, webhook
filters are not the primary control. In that case, rely on Mission Control message fields like
`agentId` and `discordUserId`.

For OpenClaw agents that receive notifications via HTTP hook (e.g. over Tailscale), set up an
incoming hook endpoint in your gateway config and register it with Mission Control via the
`RALPH_HOOK_URL` and `RALPH_HOOK_TOKEN` environment variables. See the Mission Control backend
`services/ralph.ts` for the events fired and expected payload shape.

## Install

```bash
pnpm add @mission-control/discord-agent-handler@workspace:*
```

## Usage

```ts
import { shouldProcessMessage, webhookPolicyFromEnv } from '@mission-control/discord-agent-handler';

const webhookPolicy = webhookPolicyFromEnv(process.env);

client.on('messageCreate', async (message) => {
  if (
    !shouldProcessMessage(
      {
        author: {
          id: message.author.id,
          bot: message.author.bot,
          username: message.author.username,
        },
        webhookId: message.webhookId,
      },
      {
        clientUserId: client.user!.id,
        ...webhookPolicy,
      },
    )
  ) {
    return;
  }

  // ... your agent logic
});
```

## Behavior summary

- `author.id === clientUserId` -> dropped (true self message)
- `webhookId` present:
  - allowed by default
  - if allowlists are set, must match `ALLOWED_WEBHOOK_IDS` or `ALLOWED_WEBHOOK_USERNAMES`
- non-webhook bot message (`author.bot = true`) -> dropped by default
- human non-self message -> processed

## Recommended OpenClaw defaults

- Keep `ignoreBotMessages` at default (`true`)
- Keep `allowWebhookMessages` at default (`true`)
- Set one allowlist for production hardening:
  - prefer `ALLOWED_WEBHOOK_IDS`
  - use `ALLOWED_WEBHOOK_USERNAMES` only as a secondary fallback

## Environment variables

- `ALLOWED_WEBHOOK_IDS` - comma-separated webhook IDs
- `ALLOWED_WEBHOOK_USERNAMES` - comma-separated webhook usernames

When no allowlist is set, webhook messages are accepted by default.
