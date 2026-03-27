# @mission-control/types

Shared **TypeScript** types and exports for the Mission Control workspace. Consumed by the backend, frontend, and MCP packages via the workspace protocol (`workspace:*` in each package’s `package.json`).

## Usage

Import from `@mission-control/types` in other packages; no separate build step is required for local development (see [`package.json`](package.json) `exports`).

## Lint

```bash
pnpm --filter @mission-control/types lint
```

For running the full app, see the root [README](../../README.md).
