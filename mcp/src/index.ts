import 'dotenv/config';

import { createMcpHttpApp } from './app.js';

const app = createMcpHttpApp();
const port = Number(process.env['PORT'] ?? 3002);
app.listen(port, '0.0.0.0', () => {
  console.log(`[mcp] Mission Control MCP server listening on port ${port}`);
  console.log(`[mcp] Endpoint: http://0.0.0.0:${port}/mcp`);
});
