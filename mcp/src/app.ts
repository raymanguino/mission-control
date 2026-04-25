import { randomUUID } from 'node:crypto';
import express from 'express';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { registerAgentTools } from './tools/agents.js';
import { registerProjectTools } from './tools/projects.js';
import { registerWellnessTools } from './tools/wellness.js';
import { registerChatTools } from './tools/chat.js';
import { registerUsageTools } from './tools/usage.js';
import { registerSettingsTools } from './tools/settings.js';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'mission-control',
    version: '1.0.0',
  });
  registerAgentTools(server);
  registerProjectTools(server);
  registerWellnessTools(server);
  registerChatTools(server);
  registerUsageTools(server);
  registerSettingsTools(server);
  return server;
}

type SessionEntry = {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  lastUsedAt: number;
};

function readMcpApiKey(): string {
  const key = process.env['MCP_API_KEY']?.trim();
  if (!key) throw new Error('MCP_API_KEY is required');
  return key;
}

async function createSessionEntry(sessionId: string): Promise<SessionEntry> {
  const enableJsonResponse = process.env['MCP_ENABLE_JSON_RESPONSE'] === 'true';
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionId,
    enableJsonResponse,
  });
  const server = createMcpServer();
  await server.connect(transport);
  return { server, transport, lastUsedAt: Date.now() };
}

/**
 * Express app for the Mission Control MCP Streamable HTTP server.
 * Uses session-backed transports so JSON-RPC can span multiple POSTs.
 */
export function createMcpHttpApp(): express.Express {
  const MCP_API_KEY = readMcpApiKey();
  const sessions = new Map<string, SessionEntry>();
  const ttlMs = Number(process.env['MCP_SESSION_TTL_MS'] ?? 3_600_000);

  function sweepStaleSessions(): void {
    const now = Date.now();
    for (const [id, entry] of [...sessions.entries()]) {
      if (now - entry.lastUsedAt > ttlMs) {
        sessions.delete(id);
        void entry.server.close();
      }
    }
  }

  const sweepTimer = setInterval(sweepStaleSessions, 60_000);
  sweepTimer.unref();

  const app = express();
  app.use(express.json());

  app.use('/mcp', (req, res, next) => {
    const auth = req.headers['authorization'];
    const key = auth?.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-mcp-key'];
    if (key !== MCP_API_KEY) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });

  async function resolveSessionForPost(
    req: express.Request,
    res: express.Response,
  ): Promise<SessionEntry | undefined> {
    const sessionHeaderRaw = req.headers['mcp-session-id'];
    const sessionHeader = typeof sessionHeaderRaw === 'string' ? sessionHeaderRaw.trim() : undefined;
    const body = req.body as unknown;
    if (!sessionHeader) {
      if (!body || typeof body !== 'object' || !isInitializeRequest(body)) {
        res.status(400).json({
          error: 'Mcp-Session-Id header required, or send a JSON-RPC initialize request first',
        });
        return undefined;
      }
      const sessionId = randomUUID();
      try {
        const entry = await createSessionEntry(sessionId);
        sessions.set(sessionId, entry);
        entry.lastUsedAt = Date.now();
        return entry;
      } catch (err) {
        console.error('[mcp] Failed to create session', err);
        res.status(500).json({ error: 'Failed to create MCP session' });
        return undefined;
      }
    }

    const entry = sessions.get(sessionHeader);
    if (!entry) {
      res.status(404).json({ error: 'Session not found' });
      return undefined;
    }
    entry.lastUsedAt = Date.now();
    return entry;
  }

  app.post('/mcp', async (req, res) => {
    const entry = await resolveSessionForPost(req, res);
    if (!entry) return;

    try {
      await entry.transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('[mcp] POST /mcp handleRequest failed', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  });

  app.get('/mcp', async (req, res) => {
    const sessionHeaderRaw = req.headers['mcp-session-id'];
    const sessionHeader = typeof sessionHeaderRaw === 'string' ? sessionHeaderRaw.trim() : undefined;
    if (!sessionHeader) {
      res.status(400).send('Mcp-Session-Id header is required');
      return;
    }
    const entry = sessions.get(sessionHeader);
    if (!entry) {
      res.status(404).send('Session not found');
      return;
    }
    entry.lastUsedAt = Date.now();
    try {
      await entry.transport.handleRequest(req, res);
    } catch (err) {
      console.error('[mcp] GET /mcp handleRequest failed', err);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
    }
  });

  app.delete('/mcp', async (req, res) => {
    const sessionHeaderRaw = req.headers['mcp-session-id'];
    const sessionHeader = typeof sessionHeaderRaw === 'string' ? sessionHeaderRaw.trim() : undefined;
    if (!sessionHeader) {
      res.status(400).send('Mcp-Session-Id header is required');
      return;
    }
    const entry = sessions.get(sessionHeader);
    if (!entry) {
      res.status(404).send('Session not found');
      return;
    }
    sessions.delete(sessionHeader);
    try {
      await entry.transport.handleRequest(req, res);
    } catch (err) {
      console.error('[mcp] DELETE /mcp handleRequest failed', err);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
    } finally {
      void entry.server.close();
    }
  });

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'mission-control-mcp' });
  });

  return app;
}
