# Backend

Fastify HTTP API for Mission Control: authentication, dashboard APIs, scheduled work, and optional Discord integration. Uses **Postgres** via **Drizzle ORM**.

## Run from the monorepo root

See the root [README](../README.md) for `pnpm dev` (full stack) and prerequisites.

To run only this package:

```bash
pnpm --filter backend dev
```

Default HTTP port is **3001** (`PORT` in [`.env.example`](.env.example)).

## Configuration

Copy [`.env.example`](.env.example) to `.env`. That file is the source of truth for variables (database URL, dashboard secrets, LLM keys, Discord, etc.).

## Database

Typical commands (from repo root with filter, or from this directory):

```bash
pnpm --filter backend db:generate
pnpm --filter backend db:migrate
pnpm --filter backend db:seed
```

## Build and production

```bash
pnpm --filter backend build
pnpm --filter backend start
```

## Tests and lint

```bash
pnpm --filter backend test
pnpm --filter backend lint
```
