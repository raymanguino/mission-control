# @mission-control/agent-webhook-relay

Thin webhook relay for Mission Control agent notifications.

It accepts `POST /hooks/mc`, reads the `event` field to determine the role (`cos`, `eng`, or `qa`), stores the raw payload durably, retries delivery, and hands the payload to OpenClaw as a system event.

## Current shape

- `cos` is enabled by default
- role is inferred from the `event` field in the payload
- unknown events return `400`
- payloads are passed through unchanged
- delivery is logged and retried with backoff

## Run

```bash
pnpm --filter @mission-control/agent-webhook-relay dev
```

## Environment

- `MC_WEBHOOK_HOST` (default `127.0.0.1`)
- `MC_WEBHOOK_PORT` (default `48123`)
- `MC_WEBHOOK_ENABLED_ROLES` (default `cos`)
- `MC_WEBHOOK_TOKEN_COS` (optional, if set, `Authorization: Bearer <token>` is required)
- `MC_WEBHOOK_TOKEN_ENG` (optional)
- `MC_WEBHOOK_TOKEN_QA` (optional)
- `OPENCLAW_CMD` (default `openclaw`)
- `MC_WEBHOOK_STATE_DIR` (default `state/agent-webhook-relay`)
- `MC_WEBHOOK_MAX_ATTEMPTS` (default `5`)
- `MC_WEBHOOK_RETRY_BASE_MS` (default `2000`)
- `MC_WEBHOOK_RETRY_MAX_MS` (default `300000`)
- `MC_WEBHOOK_DELIVERY_TIMEOUT_MS` (default `30000`)

## Routes

- `GET /healthz`
- `POST /hooks/mc` — role inferred from `event` field
