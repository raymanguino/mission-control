# MCP server

**Model Context Protocol** server that exposes Mission Control capabilities to MCP clients. Implemented with **Express** and the official MCP SDK; calls the Mission Control backend using a JWT and optional API key.

## Run from the monorepo root

See the root [README](../README.md) for `pnpm dev` (includes this server) and prerequisites.

To run only this package:

```bash
pnpm --filter @mission-control/mcp dev
```

Default HTTP port is **3002** (`PORT` in [`.env.example`](.env.example)).

## Configuration

Copy [`.env.example`](.env.example) to `.env`. It defines how to reach the backend (`BACKEND_URL`), authentication (`BACKEND_JWT`, `MCP_API_KEY`), and the listen port.

## Build and production

```bash
pnpm --filter @mission-control/mcp build
pnpm --filter @mission-control/mcp start
```

## Tests

```bash
pnpm --filter @mission-control/mcp test
```
