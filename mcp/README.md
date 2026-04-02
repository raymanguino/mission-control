# MCP server

**Model Context Protocol** server that exposes Mission Control capabilities to MCP clients. Implemented with **Express** and the official MCP SDK; calls the Mission Control backend with the **dashboard** JWT from `POST /api/auth/login` (same PIN as the web app), plus an MCP HTTP API key for inbound clients.

## Run from the monorepo root

See the root [README](../README.md) for `pnpm dev` (includes this server) and prerequisites.

To run only this package:

```bash
pnpm --filter @mission-control/mcp dev
```

Default HTTP port is **3002** (`PORT` in [`.env.example`](.env.example)).

## Configuration

Copy [`.env.example`](.env.example) to `.env`. Set `BACKEND_URL`, `DASHBOARD_PASSWORD` (must match the backend’s `DASHBOARD_PASSWORD`), `MCP_API_KEY` (secret for clients calling this MCP server), and optionally `PORT` (default 3002).

## Build and production

```bash
pnpm --filter @mission-control/mcp build
pnpm --filter @mission-control/mcp start
```

## Tests

```bash
pnpm --filter @mission-control/mcp test
```
