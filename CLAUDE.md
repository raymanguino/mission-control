# mission-control

Unified personal dashboard for tracking health goals, managing projects, monitoring AI agent activity, and analyzing LLM usage costs. OpenClaw agents running on Raspberry Pis report their activities and metrics to this service via REST. The dashboard is a single-user, self-hosted web app.

## Stack

Follows the standard workspace template:

- **Backend**: Fastify + Drizzle ORM (Postgres via Supabase)
- **Frontend**: React SPA (Vite) + TailwindCSS
- **DB**: Supabase (local dev via Supabase CLI, prod via hosted Supabase)
- **Monorepo**: pnpm workspaces

## Structure

```
mission-control/
├── backend/
│   └── src/
│       ├── routes/
│       │   ├── agents.ts
│       │   ├── projects.ts
│       │   ├── tasks.ts
│       │   ├── health.ts
│       │   ├── chat.ts
│       │   └── usage.ts
│       ├── services/
│       │   ├── openrouter.ts   # OpenRouter usage sync
│       │   └── cron.ts         # Scheduled jobs
│       ├── plugins/
│       │   └── auth.ts         # Dashboard + agent API key auth
│       ├── db/
│       │   └── schema.ts       # Drizzle schema
│       └── index.ts
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Agents.tsx
│       │   ├── Projects.tsx
│       │   ├── Health.tsx
│       │   ├── Chat.tsx
│       │   └── Usage.tsx
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx
│       │   │   └── Shell.tsx
│       │   ├── agents/
│       │   ├── projects/
│       │   ├── health/
│       │   ├── chat/
│       │   └── usage/
│       ├── hooks/
│       ├── utils/
│       └── main.tsx
├── supabase/
│   └── migrations/
└── packages/
    └── types/                  # Shared TypeScript types
```

## Scripts

```sh
pnpm dev            # backend (nodemon) + frontend (vite)
pnpm build          # backend (tsc) + frontend (vite build)
pnpm test           # vitest
pnpm lint           # eslint across workspace
pnpm format         # prettier across workspace
```

## DB

```sh
pnpm --filter backend db:generate   # generate Drizzle migration
pnpm --filter backend db:migrate    # apply migrations
pnpm --filter backend db:seed       # seed sample data
```

---

## Auth

Single-user dashboard. No user table.

- **Dashboard access**: The frontend stores a session token (set on login) in `localStorage`. The login page accepts a PIN/password checked against the `DASHBOARD_PASSWORD` env var. On success the backend issues a signed JWT (using `DASHBOARD_SECRET`). All API routes (except `/api/agents/report` and `/api/auth/login`) require this JWT as a Bearer token.
- **Agent auth**: Each agent is registered in the `agents` table with an `api_key_hash` (bcrypt). Agents send their raw API key in the `X-Agent-Key` header when posting to `/api/agents/report`. The backend verifies the hash.

---

## Database Schema (Drizzle)

Define all tables in `backend/src/db/schema.ts`.

### agents

```ts
{
  id: uuid (pk, default: gen_random_uuid()),
  name: text (not null),
  device: text,                // e.g. "Raspberry Pi 4"
  ip: text,
  apiKeyHash: text (not null), // bcrypt hash of the agent's API key
  lastSeen: timestamp,
  status: text default 'offline', // 'online' | 'idle' | 'offline'
  createdAt: timestamp default now()
}
```

### agent_activities

```ts
{
  id: uuid (pk, default: gen_random_uuid()),
  agentId: uuid (fk → agents.id, on delete cascade),
  type: text (not null),        // e.g. 'task_started', 'task_completed', 'error', 'info'
  description: text,
  metadata: jsonb,              // arbitrary extra data from the agent
  createdAt: timestamp default now()
}
```

### projects

```ts
{
  id: uuid (pk, default: gen_random_uuid()),
  name: text (not null),
  description: text,
  createdAt: timestamp default now(),
  updatedAt: timestamp default now()
}
```

### tasks

```ts
{
  id: uuid (pk, default: gen_random_uuid()),
  projectId: uuid (fk → projects.id, on delete cascade),
  title: text (not null),
  description: text,
  status: text default 'backlog', // 'backlog' | 'doing' | 'review' | 'done'
  assignedAgentId: uuid (fk → agents.id, nullable),
  order: integer default 0,       // for column ordering
  createdAt: timestamp default now(),
  updatedAt: timestamp default now()
}
```

### health_goals

```ts
{
  id: uuid (pk, default: gen_random_uuid()),
  name: text (not null),          // e.g. "Daily Steps"
  type: text (not null),          // 'diet' | 'exercise' | 'sleep' | 'other'
  target: numeric (not null),
  unit: text (not null),          // e.g. "steps", "kcal", "hours"
  frequency: text default 'daily', // 'daily' | 'weekly'
  createdAt: timestamp default now()
}
```

### health_entries

```ts
{
  id: uuid (pk, default: gen_random_uuid()),
  goalId: uuid (fk → health_goals.id, on delete cascade),
  value: numeric (not null),
  notes: text,
  date: date (not null),
  createdAt: timestamp default now()
}
```

### channels

```ts
{
  id: uuid (pk, default: gen_random_uuid()),
  name: text (not null),
  source: text default 'manual',  // 'discord' | 'manual'
  externalId: text,               // Discord channel ID if applicable
  createdAt: timestamp default now()
}
```

### messages

```ts
{
  id: uuid (pk, default: gen_random_uuid()),
  channelId: uuid (fk → channels.id, on delete cascade),
  author: text (not null),
  content: text (not null),
  agentId: uuid (fk → agents.id, nullable), // null = human message
  createdAt: timestamp default now()
}
```

### usage_records

```ts
{
  id: uuid (pk, default: gen_random_uuid()),
  agentId: uuid (fk → agents.id, nullable),
  apiKeyLabel: text,    // OpenRouter key label/name
  model: text,
  tokensIn: integer,
  tokensOut: integer,
  costUsd: numeric(10, 6),
  recordedAt: timestamp (not null),  // from OpenRouter's data
  createdAt: timestamp default now()
}
```

---

## API Routes

All routes are prefixed with `/api`. All routes except `/api/auth/login` and `POST /api/agents/report` require the dashboard JWT.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Accepts `{ password }`, returns JWT on success |

### Agents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Register a new agent (returns plaintext API key once) |
| GET | `/api/agents/:id` | Get single agent |
| PATCH | `/api/agents/:id` | Update name/device/ip |
| DELETE | `/api/agents/:id` | Remove agent |
| GET | `/api/agents/:id/activity` | Activity log (paginated, `?limit&offset`) |
| POST | `/api/agents/report` | **Agent-authenticated.** Upsert agent status + insert activity entry |

`POST /api/agents/report` body:
```json
{
  "type": "task_started",
  "description": "Began linting project files",
  "metadata": { "project": "six7swe", "files": 42 }
}
```

### Projects & Tasks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| PATCH | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| GET | `/api/projects/:id/tasks` | Tasks for a project |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/:id` | Update task (status, title, description, order, assignedAgentId) |
| DELETE | `/api/tasks/:id` | Delete task |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health/goals` | List goals |
| POST | `/api/health/goals` | Create goal |
| PATCH | `/api/health/goals/:id` | Update goal |
| DELETE | `/api/health/goals/:id` | Delete goal |
| GET | `/api/health/entries` | List entries (`?goalId&from&to`) |
| POST | `/api/health/entries` | Log entry |
| PATCH | `/api/health/entries/:id` | Edit entry |
| DELETE | `/api/health/entries/:id` | Delete entry |

### Chat

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/channels` | List channels |
| POST | `/api/channels` | Create channel |
| DELETE | `/api/channels/:id` | Delete channel |
| GET | `/api/channels/:id/messages` | Messages (paginated, `?limit&before`) |
| POST | `/api/channels/:id/messages` | Post message |

### Usage & Costs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/usage` | Aggregated usage (`?from&to&groupBy=model\|apiKey\|agent`) |
| GET | `/api/usage/records` | Raw records (paginated) |
| POST | `/api/usage/sync` | Trigger manual OpenRouter sync |

---

## OpenRouter Integration

Service: `backend/src/services/openrouter.ts`

- Uses the [OpenRouter Usage Accounting API](https://openrouter.ai/docs/guides/administration/usage-accounting)
- Endpoint: `GET https://openrouter.ai/api/v1/credits/usage` with `Authorization: Bearer <OPENROUTER_API_KEY>`
- Fetches usage data and upserts into `usage_records` (deduped by `recordedAt` + `model` + `apiKeyLabel`)
- Called by a `node-cron` job every hour (`0 * * * *`) and also on-demand via `POST /api/usage/sync`
- Env vars: `OPENROUTER_API_KEY`

---

## Frontend

### Layout

Full-height layout with a fixed left sidebar and main content area. The sidebar shows:
- App name / logo at top
- Navigation links: Agents, Projects, Health, Chat, Usage
- Agent status indicators (colored dots from polling `/api/agents` every 30s)

Use React Router for client-side routing.

### Pages

**Agents** (`/agents`)
- Card grid showing each agent: name, device, IP, status dot, last seen
- Click into an agent to see its activity feed (polling every 10s)

**Projects** (`/projects`)
- Sidebar list of projects; clicking loads the kanban board
- Kanban board: 4 columns (Backlog, Doing, Review, Done), drag-and-drop cards (use `@dnd-kit/core`)
- Card shows title, assigned agent avatar/name, description preview
- Add/edit/delete tasks via a slide-over panel

**Health** (`/health`)
- Goal cards with progress bar (today's entries vs. target)
- Log entry button opens a modal
- Chart showing last 30 days per goal (use `recharts`)

**Chat** (`/chat`)
- Left panel: channel list
- Right panel: message thread, polling every 5s
- Input bar to post messages

**Usage** (`/usage`)
- Summary cards: total cost, total tokens this month
- Bar chart grouped by model or API key (toggle)
- Table of raw records
- "Sync now" button calls `POST /api/usage/sync`

---

## Environment Variables

```
# backend/.env
DATABASE_URL=postgresql://...
DASHBOARD_PASSWORD=changeme
DASHBOARD_SECRET=a-long-random-secret
OPENROUTER_API_KEY=sk-or-...
PORT=3001
```

```
# frontend/.env
VITE_API_URL=http://localhost:3001
```

---

## Architecture Notes

- **OpenClaw** agents run on Raspberry Pis and self-report to this service. OpenClaw docs: https://docs.openclaw.ai/
- **OpenRouter** is used by agents for LLM calls; this service reads cost data from the OpenRouter Usage Accounting API.
- The dashboard is stateless with respect to auth — JWT expiry is 30 days, no refresh tokens needed.
- Use `@fastify/cors` to allow the frontend origin in dev.
- Use `@fastify/jwt` for JWT signing/verification.
- Drizzle migrations live in `supabase/migrations/` (use `drizzle-kit generate` → `supabase/migrations/`).
- The frontend polls for live data rather than using WebSockets, keeping the architecture simple.
