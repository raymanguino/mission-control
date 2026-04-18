# Agent Integration Guide

This document is the authoritative reference for AI agents integrating with Mission Control — webhook events, payload shapes, agent registration, and self-setup.

---

## Architecture Overview

Mission Control POSTs JSON events to your OpenClaw relay at **`{MC_WEBHOOK_BASE_URL}/hooks/mc/{role}`** with **`Authorization: Bearer {MC_WEBHOOK_TOKEN}`**. Roles map to paths: **`cos`**, **`eng`**, **`qa`**.

For the receiver implementation, see [`packages/agent-webhook-relay/`](../packages/agent-webhook-relay/), which listens on `/hooks/mc/<role>` and forwards the raw body.

Agent **`orgRole`** (`chief_of_staff`, `engineer`, `qa`) is still assigned at registration time for instructions and dashboards; **webhook routing is no longer per-agent**—it uses the server-wide base URL and token.

---

## Registering a New Agent

### 1. Register via REST API

```bash
curl -X POST http://localhost:3001/api/agents \
  -H "Authorization: Bearer <dashboard-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Agent Name",
    "email": "agent@example.com",
    "specialization": "dev",
    "description": "What this agent does.",
    "device": "hostname",
    "model": "claude-3-5-sonnet"
  }'
```

The response includes `apiKey` — store it. It authenticates MCP and REST calls. Webhook delivery uses **`MC_WEBHOOK_BASE_URL`** and **`MC_WEBHOOK_TOKEN`** in Mission Control’s environment, not fields on the agent row.

### 2. Configure OpenClaw hook mapping

In `~/.openclaw/openclaw.json`, map `hooks.mappings` so paths under `/hooks/mc` wake your agent (see relay package README).

### 3. Mission Control environment

Set on the Mission Control server (e.g. `backend/.env`):

- **`MC_WEBHOOK_BASE_URL`** — origin only, e.g. `https://your-tailscale-host` or `http://127.0.0.1:48123`
- **`MC_WEBHOOK_TOKEN`** — shared bearer sent on every role webhook POST
- **`AGENT_WEBHOOKS_ENABLED`** — set to `false` to disable all outbound webhooks

---

## Webhook delivery

```
POST {MC_WEBHOOK_BASE_URL}/hooks/mc/{cos|eng|qa}
Authorization: Bearer {MC_WEBHOOK_TOKEN}
Content-Type: application/json
```

**Baseline JSON fields (all events):**

- `event` — string (see below)
- `projectId` — UUID
- `project` — `{ "id": string, "name": string }`
- `agentInstructions` — playbook text for the target role

---

### `project.pending_approval` → `/hooks/mc/cos`

Fired when a new project is created (pending approval).

**Payload:**

```json
{
  "event": "project.pending_approval",
  "projectId": "<uuid>",
  "project": { "id": "<uuid>", "name": "…" },
  "agentInstructions": "…"
}
```

---

### `project.backlog_updated` → `/hooks/mc/eng`

Fired on every task create and task update. Does **not** include `taskId`.

**Payload:**

```json
{
  "event": "project.backlog_updated",
  "projectId": "<uuid>",
  "project": { "id": "<uuid>", "name": "…" },
  "agentInstructions": "…"
}
```

---

### `project.all_tasks_completed` → `/hooks/mc/qa`

Fired when **every** task in the project has `status === "review"`.

**Payload:**

```json
{
  "event": "project.all_tasks_completed",
  "projectId": "<uuid>",
  "project": { "id": "<uuid>", "name": "…" },
  "agentInstructions": "…"
}
```

---

### `project.review_completed` → `/hooks/mc/cos`

Fired when a task moves from `review` to `done`.

**Payload:**

```json
{
  "event": "project.review_completed",
  "projectId": "<uuid>",
  "project": { "id": "<uuid>", "name": "…" },
  "taskId": "<uuid>",
  "agentInstructions": "…"
}
```

---

## MCP API

**Auth:** dashboard JWT or agent API key as `Authorization: Bearer …` depending on route.

Key tools: `list_projects`, `get_project`, `update_project`, `create_task`, `update_task`, `list_agents`, `get_settings`, etc.

---

## Debugging

```bash
curl -X POST "http://127.0.0.1:48123/hooks/mc/cos" \
  -H "Authorization: Bearer <MC_WEBHOOK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"event":"project.pending_approval","projectId":"…","project":{"id":"…","name":"Test"},"agentInstructions":""}'
```

---

## Adding a new event

1. Implement the outbound POST in `backend/src/services/agentNotifier.ts` (or route handler), reusing the same env-backed POST pattern and `McWebhookRole` path.
2. Document the payload here.
3. Extend the relay / OpenClaw transform if needed.
