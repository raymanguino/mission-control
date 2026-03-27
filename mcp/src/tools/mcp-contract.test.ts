import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerAgentTools } from './agents.js';
import { registerChatTools } from './chat.js';
import { registerIntentTools } from './intents.js';
import { registerProjectTools } from './projects.js';
import { registerUsageTools } from './usage.js';
import { registerWellnessTools } from './wellness.js';
import {
  mcpBackendEndpointPaths,
  mcpToolContracts,
} from '../../../backend/src/contracts/mcp-contract.js';

vi.mock('../client.js', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

type RegisteredTool = {
  description: string;
  input: Record<string, { safeParse: (value: unknown) => { success: boolean } }>;
};

function getRegisteredTools() {
  const tools: Record<string, RegisteredTool> = {};
  const server = {
    tool: (
      name: string,
      description: string,
      input: Record<string, { safeParse: (value: unknown) => { success: boolean } }>,
    ) => {
      tools[name] = { description, input };
    },
  } as unknown;

  registerAgentTools(server as never);
  registerProjectTools(server as never);
  registerIntentTools(server as never);
  registerWellnessTools(server as never);
  registerChatTools(server as never);
  registerUsageTools(server as never);

  return tools;
}

function isOptional(schema: { safeParse: (value: unknown) => { success: boolean } }) {
  return schema.safeParse(undefined).success;
}

function normalizePath(path: string) {
  const withoutQuery = path.split('?')[0] ?? path;
  return withoutQuery
    .replace(/\$\{[^}]+\}/g, ':param')
    .replace(/:[A-Za-z0-9_]+/g, ':param');
}

function extractApiPathsFromToolSources() {
  const currentDir = fileURLToPath(new URL('.', import.meta.url));
  const toolFiles = [
    'agents.ts',
    'projects.ts',
    'intents.ts',
    'wellness.ts',
    'chat.ts',
    'usage.ts',
  ];

  const paths = new Set<string>();
  for (const file of toolFiles) {
    const source = readFileSync(resolve(currentDir, file), 'utf8');
    const matches = source.match(/\/api\/[A-Za-z0-9_/$?{}=&:-]+/g) ?? [];
    for (const match of matches) {
      paths.add(normalizePath(match));
    }
  }

  return paths;
}

describe('MCP contracts stay in sync', () => {
  it('registers exactly the tools defined in backend contract', () => {
    const registered = getRegisteredTools();
    expect(Object.keys(registered).sort()).toEqual(Object.keys(mcpToolContracts).sort());
  });

  it('matches contract input keys and optionality for each tool', () => {
    const registered = getRegisteredTools();

    for (const [toolName, contract] of Object.entries(mcpToolContracts)) {
      const tool = registered[toolName];
      expect(tool, `${toolName} must be registered`).toBeTruthy();

      const actualInput = tool.input ?? {};
      const expectedInput = contract.input ?? {};
      expect(Object.keys(actualInput).sort(), `${toolName} input keys`).toEqual(
        Object.keys(expectedInput).sort(),
      );

      for (const [key, expectedSchema] of Object.entries(expectedInput)) {
        const actualSchema = actualInput[key];
        expect(actualSchema, `${toolName}.${key} schema exists`).toBeTruthy();
        expect(
          isOptional(actualSchema) === isOptional(expectedSchema),
          `${toolName}.${key} optionality matches contract`,
        ).toBe(true);
      }
    }
  });

  it('uses only API paths declared in backend contract', () => {
    const seenPaths = extractApiPathsFromToolSources();
    const contractPaths = new Set(mcpBackendEndpointPaths.map(normalizePath));

    for (const path of seenPaths) {
      expect(contractPaths.has(path), `MCP path ${path} is missing from contract`).toBe(true);
    }
  });
});
