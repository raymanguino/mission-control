import 'dotenv/config';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { registerAgentTools } from './tools/agents.js';
import { registerProjectTools } from './tools/projects.js';
import { registerIntentTools } from './tools/intents.js';
import { registerWellnessTools } from './tools/wellness.js';
import { registerChatTools } from './tools/chat.js';
import { registerUsageTools } from './tools/usage.js';
import { registerSettingsTools } from './tools/settings.js';

const MCP_API_KEY = process.env['MCP_API_KEY'];
if (!MCP_API_KEY) throw new Error('MCP_API_KEY is required');

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'mission-control',
    version: '1.0.0',
  });
  registerAgentTools(server);
  registerProjectTools(server);
  registerIntentTools(server);
  registerWellnessTools(server);
  registerChatTools(server);
  registerUsageTools(server);
  registerSettingsTools(server);
  return server;
}

const app = express();
app.use(express.json());

// Auth middleware
app.use('/mcp', (req, res, next) => {
  const auth = req.headers['authorization'];
  const key = auth?.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-mcp-key'];
  if (key !== MCP_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

// MCP endpoint — stateless: each request gets a fresh server + transport
app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createMcpServer();
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } finally {
    res.on('finish', () => server.close().catch(() => {}));
  }
});

// SSE upgrade for clients that open a persistent GET (e.g. mcp-remote)
app.get('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createMcpServer();
  await server.connect(transport);
  await transport.handleRequest(req, res);
  req.on('close', () => server.close().catch(() => {}));
});

app.delete('/mcp', (_req, res) => {
  res.status(405).send('Method Not Allowed');
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'mission-control-mcp' });
});

const port = Number(process.env['PORT'] ?? 3002);
app.listen(port, '0.0.0.0', () => {
  console.log(`[mcp] Mission Control MCP server listening on port ${port}`);
  console.log(`[mcp] Endpoint: http://0.0.0.0:${port}/mcp`);
});
