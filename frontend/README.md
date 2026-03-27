# Frontend

React single-page app built with **Vite**, **Tailwind CSS**, and **React Router**. Consumes the backend API (in dev, the Vite server proxies `/api` to the API URL in [`.env.example`](.env.example)).

## Run from the monorepo root

See the root [README](../README.md) for `pnpm dev` and prerequisites.

To run only this package:

```bash
pnpm --filter frontend dev
```

The dev server uses port **5173** (see `vite.config.ts`).

## Configuration

Copy [`.env.example`](.env.example) to `.env`. `VITE_API_URL` sets where `/api` is proxied during local development (defaults to `http://localhost:3001` if unset).

## Build and preview

```bash
pnpm --filter frontend build
pnpm --filter frontend preview
```

## Lint

```bash
pnpm --filter frontend lint
```
