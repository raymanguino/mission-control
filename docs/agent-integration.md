# Agent Integration Guide

This document is the authoritative reference for AI agents integrating with Mission Control — webhook events, payload shapes, agent registration, and self-setup.

---

## Architecture Overview

Mission Control POSTs JSON events to your OpenClaw relay at **`{MC_WEBHOOK_BASE_URL}/hooks/mc`** with **`Authorization: Bearer {MC_WEBHOOK_TOKEN}`**. The role is inferred from the `event` field in the payload: `project.pending_approval` / `project.review_completed` → **`cos`**, `project.backlog_updated` → **`eng`**, `project.all_tasks_completed` → **`qa`**.

For the receiver implementation, see [`packages/agent-webhook-relay/`](../packages/agent-webhook-relay/), which listens on `/hooks/mc` and routes based on the `event` field.

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
POST {MC_WEBHOOK_BASE_URL}/hooks/mc
Authorization: Bearer {MC_WEBHOOK_TOKEN}
Content-Type: application/json
```

**Baseline JSON fields (all events):**

- `event` — event name string (see below)
- `project` — `{ "id": string, "name": string }`
- `agentInstructions` — playbook text for the target role (`chief_of_staff`, `engineer`, or `qa`)
- `agents` — array of agent names belonging to the target role

---

### `project.pending_approval`

Fired when a new project is created (pending approval).

**Payload:**

```json
{
  "event": "project.pending_approval",
  "project": { "id": "<uuid>", "name": "…" },
  "agentInstructions": "…",
  "agents": ["Ralph"]
}
```

---

### `project.backlog_updated`

Fired on every task create and task update.

**Payload:**

```json
{
  "event": "project.backlog_updated",
  "project": { "id": "<uuid>", "name": "…" },
  "agentInstructions": "…",
  "agents": ["…"]
}
```

---

### `project.all_tasks_completed`

Fired when every task in the project has `status === "review"`.

**Payload:**

```json
{
  "event": "project.all_tasks_completed",
  "project": { "id": "<uuid>", "name": "…" },
  "agentInstructions": "…",
  "agents": ["…"]
}
```

---

### `project.review_completed`

Fired when every task in the project is `done` or `not_done`.

**Payload:**

```json
{
  "event": "project.review_completed",
  "project": { "id": "<uuid>", "name": "…" },
  "agentInstructions": "…",
  "agents": ["Ralph"]
}
```

---

## MCP API

**Auth:** dashboard JWT or agent API key as `Authorization: Bearer …` depending on route.

Key tools: `list_projects`, `get_project`, `update_project`, `create_task`, `update_task`, `list_agents`, `get_settings`, etc.

---

## Debugging

```bash
curl -X POST "http://127.0.0.1:48123/hooks/mc" \
  -H "Authorization: Bearer <MC_WEBHOOK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"event":"project.pending_approval","project":{"id":"…","name":"Test"},"agentInstructions":""}'
```

---

## Adding a new event

1. Implement the outbound POST in `backend/src/services/agentNotifier.ts` (or route handler), reusing the same env-backed POST pattern. Role is still inferred from the `event` field via `inferRoleFromEvent`.
2. Document the payload here.
3. Extend `inferRoleFromEvent` in the relay if the new event needs a different role.
