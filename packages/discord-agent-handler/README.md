# @mission-control/discord-agent-handler

Shared message handler utilities for Discord-based agents.

Use this package to keep agent filtering behavior consistent:
- Skip true self messages by user ID
- Allow Mission Control webhook messages
- Optionally allowlist trusted webhook IDs/usernames

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

## Environment variables

- `ALLOWED_WEBHOOK_IDS` - comma-separated webhook IDs
- `ALLOWED_WEBHOOK_USERNAMES` - comma-separated webhook usernames

When no allowlist is set, webhook messages are accepted by default.
