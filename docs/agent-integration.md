# Agent Integration Guide

This document is the authoritative reference for any AI agent integrating with Mission Control — webhook events, payload shapes, handler workflows, agent registration, and self-setup instructions.

If you are an agent reading this cold: follow this guide to get yourself operational without needing a human in the loop.

---

## Architecture Overview

Mission Control fires webhook events to registered agents over Tailscale. Agents receive events, execute workflows, and report back via the MCP API or REST API.

```
Mission Control (laptop-f2vfct8b)
  └─ POST /hooks/<path>  →  Agent OpenClaw instance (Tailscale)
                              └─ transform.js routes to agent session
                                   └─ Agent executes workflow via MCP tools
```

**Current agents:**

| Agent | Host | Tailscale URL | Role |
|-------|------|---------------|------|
| Ralph | six7swe-leader | `https://six7swe-leader.tailc28236.ts.net` | Chief of Staff — project approval, decomposition, task assignment |
| Hermes | six7swe-worker | `https://six7swe-worker.tailc28236.ts.net` | Dev task executor |

---

## Registering a New Agent

### 1. Register via REST API

```bash
curl -X POST http://laptop-f2vfct8b.tailc28236.ts.net:3001/api/agents \
  -H "Authorization: Bearer <admin-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Agent Name",
    "email": "agent@example.com",
    "specialization": "dev",
    "description": "What this agent does and what tasks it should receive.",
    "device": "hostname",
    "ip": "100.x.x.x",
    "hookUrl": "https://your-tailscale-host.tailc28236.ts.net/hooks/mc",
    "hookToken": "your-secret-token"
  }'
```

The response includes your `agentId` and `apiKey` — store both. The `agentId` is used in task assignments; the `apiKey` authenticates MCP and REST calls on your behalf.

### 2. Configure your OpenClaw hook mapping

In `~/.openclaw/openclaw.json`, add a mapping under `hooks.mappings`:

```json
{
  "id": "mission-control-notify",
  "match": { "path": "mc" },
  "action": "wake",
  "name": "Mission Control → <AgentName>",
  "transform": { "module": "mc-notify-transform.js" }
}
```

> **Note:** `match.path` is the sub-path *after* `/hooks/` — use `"mc"` not `"/hooks/mc"`.

### 3. Write your transform

Create `~/.openclaw/hooks/transforms/mc-notify-transform.js`. The transform receives the raw POST body and returns a `wake` action that injects a system event into your agent session.

See Ralph's transform at `~/.openclaw/hooks/transforms/mc-notify-transform.js` on six7swe-leader as a reference implementation.

### 4. Set MC environment variables

In the Mission Control backend `.env`:

```
RALPH_HOOK_URL=https://your-tailscale-host.tailc28236.ts.net/hooks/mc
RALPH_HOOK_TOKEN=your-secret-token
```

*(Variable names are Ralph-specific for now; a multi-agent routing layer is a future improvement.)*

---

## Webhook Events

All events are delivered as:

```
POST <hookUrl>
Authorization: Bearer <hookToken>
Content-Type: application/json
```

---

### `project.approval_requested`

Fired when a new project is submitted and needs Chief of Staff review.

**Payload:**
```json
{
  "event": "project.approval_requested",
  "project": {
    "id": "<uuid>",
    "name": "Project name",
    "description": "What the requester wants built or done."
  }
}
```

**Expected handler workflow (Chief of Staff):**
1. Call `get_project(id)` to load full details.
2. If the project cannot be built as a web app → `update_project(id, { status: "denied" })` and stop.
3. Expand the description into a clear, implementation-ready plan.
4. Call `create_task(...)` for each discrete task (split by concern: frontend / backend / database / integration / testing / docs).
5. Call `list_agents()` to review available agents and specializations.
6. Assign each task to the best-fit agent via `assignedAgentId`.
7. Call `update_project(id, { status: "approved" })`.
8. Send a summary notification (WhatsApp or channel of choice).

**MCP tools:** `get_project`, `update_project`, `create_task`, `list_agents`

---

### `task.assigned`

Fired when a task is assigned to your agent.

**Payload:**
```json
{
  "event": "task.assigned",
  "task": {
    "id": "<uuid>",
    "title": "Task title",
    "description": "What needs to be done.",
    "projectName": "Parent project name",
    "assignedAgentId": "<your-agent-id>"
  }
}
```

**Expected handler workflow (Task Agent):**
1. Call `update_task(id, { status: "doing" })`.
2. Call `get_project(...)` to get the optional GitHub URL and full context.
3. If no GitHub repo exists, create one named `<project-name>-<project-id>`.
4. Implement the task using available MCP tools.
5. Push implementation to the repo.
6. Call `update_project(...)` to set or update the GitHub URL.
7. Call `update_task(id, { status: "review" })` when complete.

**MCP tools:** `update_task`, `get_project`, `update_project`

---

### `instructions.updated`

Fired when the Chief of Staff instructions in MC settings are updated.

**Payload:**
```json
{
  "event": "instructions.updated"
}
```

**Expected handler workflow:**
1. Call `get_settings()` to fetch the latest instructions.
2. Update local memory/context with any meaningful changes.
3. Re-check in-flight work for conflicts with the new instructions.
4. Send a brief confirmation that instructions were refreshed.

**MCP tools:** `get_settings`

---

## MCP API

**URL:** `http://laptop-f2vfct8b.tailc28236.ts.net:3002/mcp`  
**Auth:** `Authorization: Bearer <mcp-api-key>`

Key tools available to agents:

| Tool | Description |
|------|-------------|
| `get_project(id)` | Load full project details |
| `update_project(id, patch)` | Update project fields (status, description, githubUrl, etc.) |
| `create_task(fields)` | Create a task with title, description, projectId, assignedAgentId |
| `update_task(id, patch)` | Update task fields (status, notes, etc.) |
| `list_agents()` | List all registered agents with specializations |
| `assign_task(taskId, agentId)` | Assign a task to an agent |
| `get_settings()` | Fetch current CoS instructions and system settings |
| `get_intent(id)` | Load an intent (pre-project request) |
| `quick_log_food(text)` | Free-text food log (for personal agents) |
| `log_cannabis_session(form, ...)` | Cannabis session log (for personal agents) |
| `log_sleep(bedTime)` | Sleep log (for personal agents) |
| `update_sleep_log(id, ...)` | Update sleep log with wake time (for personal agents) |

---

## Debugging

```bash
# Tail OpenClaw gateway logs on the agent Pi
journalctl --user -u openclaw-gateway.service -f

# Manually fire a test event (from any Tailscale node)
curl -X POST https://six7swe-leader.tailc28236.ts.net/hooks/mc \
  -H "Authorization: Bearer <hookToken>" \
  -H "Content-Type: application/json" \
  -d '{"event":"project.approval_requested","project":{"id":"test-123","name":"Test","description":"A test project."}}'
```

---

## Adding a New Event

1. Add the event to `backend/src/services/ralph.ts` — fire a POST to each subscribed agent's `hookUrl`.
2. Document the payload shape and handler expectations in this file.
3. Update each agent's transform (`mc-notify-transform.js`) to handle the new event.
4. Test with a manual curl POST.
