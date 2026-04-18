import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { mcpToolContracts } from '../../backend/src/contracts/mcp-contract.js';
import { createMcpHttpApp } from './app.js';

describe('MCP Streamable HTTP wire: tools/list vs contract', () => {
  const originalKey = process.env['MCP_API_KEY'];
  const originalJson = process.env['MCP_ENABLE_JSON_RESPONSE'];

  beforeEach(() => {
    process.env['MCP_API_KEY'] = 'test-mcp-key';
    process.env['MCP_ENABLE_JSON_RESPONSE'] = 'true';
  });

  afterEach(() => {
    process.env['MCP_API_KEY'] = originalKey;
    process.env['MCP_ENABLE_JSON_RESPONSE'] = originalJson;
  });

  it('returns exactly the tool names declared in mcpToolContracts', async () => {
    const app = createMcpHttpApp();

    const acceptMcp = 'application/json, text/event-stream';
    const initRes = await request(app)
      .post('/mcp')
      .set('Accept', acceptMcp)
      .set('Authorization', 'Bearer test-mcp-key')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'vitest', version: '1.0.0' },
        },
      });

    expect(initRes.status).toBe(200);
    const sessionId = initRes.headers['mcp-session-id'];
    expect(sessionId).toBeTruthy();

    const initBody = initRes.body as { result?: { protocolVersion?: string } };
    const protocolVersion = initBody.result?.protocolVersion ?? '2025-03-26';

    const initializedRes = await request(app)
      .post('/mcp')
      .set('Accept', acceptMcp)
      .set('Authorization', 'Bearer test-mcp-key')
      .set('Mcp-Session-Id', String(sessionId))
      .set('Mcp-Protocol-Version', protocolVersion)
      .send({ jsonrpc: '2.0', method: 'notifications/initialized' });

    expect([200, 202]).toContain(initializedRes.status);

    const listRes = await request(app)
      .post('/mcp')
      .set('Accept', acceptMcp)
      .set('Authorization', 'Bearer test-mcp-key')
      .set('Mcp-Session-Id', String(sessionId))
      .set('Mcp-Protocol-Version', protocolVersion)
      .send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });

    expect(listRes.status).toBe(200);
    const tools = (listRes.body as { result?: { tools?: { name: string }[] } }).result?.tools;
    expect(tools).toBeTruthy();
    const names = tools!.map((t) => t.name).sort();
    expect(names).toEqual(Object.keys(mcpToolContracts).sort());
  });
});
