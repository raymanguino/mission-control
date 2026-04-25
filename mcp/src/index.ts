import 'dotenv/config';

import { createMcpHttpApp } from './app.js';

const app = createMcpHttpApp();
const port = Number(process.env['PORT'] ?? 3002);
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[mcp] Mission Control MCP server listening on port ${port}`);
  console.log(`[mcp] Endpoint: http://0.0.0.0:${port}/mcp`);
});

function gracefulShutdown() {
  console.log('[mcp] Shutting down gracefully...');
  server.close(() => {
    console.log('[mcp] HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[mcp] Forcefully exiting after timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
