/**
 * Regenerates Bruno request YAML:
 * - `.bruno/mission-control/mcp` — MCP-aligned names (e.g. get_settings.yml)
 * - `.bruno/mission-control/rest` — raw HTTP API (same routes; e.g. settings.yml for GET /api/settings)
 *
 * Sources: mcpToolContracts + estimate_food (POST /api/health/food/estimate).
 *
 * Run from repo root: pnpm gen:bruno
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mcpToolContracts } from '../backend/src/contracts/mcp-contract.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRUNO_MISSION_CONTROL = join(__dirname, '..', '.bruno', 'mission-control');
const MCP_BRUNO_ROOT = join(BRUNO_MISSION_CONTROL, 'mcp');
const REST_BRUNO_ROOT = join(BRUNO_MISSION_CONTROL, 'rest');

/** Tool name → Bruno subfolder (matches MCP modules and backend route groups in routes/index.ts). */
const FOLDER_TOOLS: Record<string, string[]> = {
  agents: ['list_agents', 'get_agent_activity', 'create_agent', 'update_agent', 'delete_agent'],
  projects: [
    'list_projects',
    'create_project',
    'delete_project',
    'get_task',
    'list_tasks',
    'create_task',
    'update_task',
    'delete_task',
  ],
  intents: [
    'list_intents',
    'get_intent',
    'create_intent',
    'update_intent',
    'convert_intent_to_project',
    'delete_intent',
  ],
  chat: ['list_channels', 'get_messages', 'post_message', 'delete_channel'],
  usage: ['get_usage', 'get_usage_records', 'get_ai_config', 'sync_usage'],
  wellness: [
    'estimate_food',
    'log_food',
    'quick_log_food',
    'list_food_logs',
    'delete_food_log',
    'log_cannabis_session',
    'list_cannabis_sessions',
    'delete_marijuana_session',
    'log_sleep',
    'update_sleep_log',
    'list_sleep_logs',
    'delete_sleep_log',
    'run_health_analysis',
  ],
  settings: ['get_settings', 'update_settings'],
};

/** Optional example query string (including `?`) appended to the path. */
const QUERY_EXAMPLES: Partial<Record<string, string>> = {
  get_agent_activity: '?limit=20',
  get_messages: '?limit=50',
  get_usage: '?groupBy=model',
  get_usage_records: '?limit=50&offset=0',
  list_food_logs: '?date=2026-03-28',
  list_cannabis_sessions: '?from=2026-03-01&to=2026-03-28',
  list_sleep_logs: '?from=2026-03-21&to=2026-03-28',
};

/** Example JSON bodies for POST/PATCH (path params excluded). Matches backend HTTP bodies (not MCP tool input wrappers). */
const BODY_JSON: Partial<Record<string, object>> = {
  create_agent: {
    name: 'Agent Alpha',
    email: 'agent@example.com',
    specialization: 'Frontend React',
    description: 'Detailed skills profile',
    device: 'Laptop',
    ip: '192.168.1.10',
  },
  update_agent: {
    name: 'Updated name',
    email: 'updated@example.com',
    specialization: 'Backend',
    orgRole: 'member',
    reportsToAgentId: null,
  },
  create_project: {
    name: 'New project',
    description: 'Optional description',
  },
  create_task: {
    projectId: '00000000-0000-4000-8000-000000000002',
    title: 'Implement feature',
    description: 'Task details',
    status: 'backlog',
    assignedAgentId: '00000000-0000-4000-8000-000000000001',
  },
  update_task: {
    title: 'Updated title',
    status: 'doing',
    description: null,
    assignedAgentId: '00000000-0000-4000-8000-000000000001',
  },
  create_intent: {
    title: 'Idea title',
    body: 'Intent body text',
    status: 'open',
  },
  update_intent: {
    title: 'Updated title',
    body: 'Updated body',
    status: 'open',
    createdProjectId: null,
  },
  convert_intent_to_project: {
    projectName: 'From intent',
    projectDescription: 'Optional project description',
  },
  post_message: {
    content: 'Hello from Bruno',
    author: 'Claude',
  },
  log_food: {
    mealType: 'lunch',
    description: 'Grilled chicken salad with avocado',
    loggedAt: '2026-03-28T18:30:00.000Z',
    date: '2026-03-28',
    calories: 520,
    protein: 42,
    carbs: 28,
    fat: 24,
    notes: 'optional note',
  },
  quick_log_food: {
    text: 'Oatmeal with berries this morning',
  },
  estimate_food: {
    description: 'Grilled chicken salad with avocado',
  },
  log_cannabis_session: {
    form: 'flower',
    sessionAt: '2026-03-28T20:00:00.000Z',
    date: '2026-03-28',
    strain: 'Optional strain',
    amount: '0.5',
    unit: 'g',
    notes: 'optional',
  },
  log_sleep: {
    bedTime: '2026-03-28T01:00:00.000Z',
    wakeTime: '2026-03-28T09:00:00.000Z',
    qualityScore: 4,
    date: '2026-03-28',
    notes: 'optional',
  },
  update_sleep_log: {
    wakeTime: '2026-03-28T09:30:00.000Z',
    qualityScore: 5,
    notes: 'Woke up refreshed',
  },
  run_health_analysis: {
    goal: 'Improve sleep quality',
    goals: ['Track meals more consistently'],
  },
  update_settings: {
    some_key: 'some_value',
  },
};

const SETTINGS_YAML = `settings:
  encodeUrl: false
  timeout: 0
  followRedirects: true
  maxRedirects: 5`;

/** REST collection: Bruno request `info.name` (default: tool name). */
const REST_INFO_NAMES: Partial<Record<string, string>> = {
  get_settings: 'settings',
};

/** REST collection: filename without `.yml` (default: tool name). */
const REST_FILE_NAMES: Partial<Record<string, string>> = {
  get_settings: 'settings',
};

/** Root `rest/folder.yml` seq in the Bruno collection. */
const REST_ROOT_FOLDER_SEQ = 2;

function pathToBrunoPath(path: string): string {
  return path.replace(/:([a-zA-Z]+)/g, '{{$1}}');
}

function methodToBruno(method: string): string {
  return method.toLowerCase();
}

function buildUrl(toolName: string, contractPath: string): string {
  const base = pathToBrunoPath(contractPath);
  const q = QUERY_EXAMPLES[toolName] ?? '';
  return `http://{{host}}:{{port}}${base}${q}`;
}

function renderFolderYml(folderName: string, seq: number): string {
  return [
    'info:',
    `  name: ${folderName}`,
    '  type: folder',
    `  seq: ${seq}`,
    '',
    'request:',
    '  auth: inherit',
    '',
  ].join('\n');
}

function renderRequest(
  toolName: string,
  seq: number,
  method: string,
  url: string,
  body?: object,
  infoName?: string,
): string {
  const m = methodToBruno(method);
  const displayName = infoName ?? toolName;
  const lines: string[] = [
    'info:',
    `  name: ${displayName}`,
    '  type: http',
    `  seq: ${seq}`,
    '',
    'http:',
    `  method: ${m}`,
    `  url: ${url}`,
    '  headers:',
    '    - name: Authorization',
    '      value: Bearer {{token}}',
  ];

  if (body !== undefined && ['post', 'patch'].includes(m)) {
    lines.push('    - name: Content-Type', '      value: application/json');
    const json = JSON.stringify(body, null, 2);
    lines.push('  body:', '    type: json', '    data: |-', ...json.split('\n').map((l) => `      ${l}`));
  }

  lines.push('  auth: inherit', '', SETTINGS_YAML, '');
  return lines.join('\n');
}

function validateMapping(): void {
  const flat = Object.values(FOLDER_TOOLS).flat();
  const contractKeys = Object.keys(mcpToolContracts);
  const extras = flat.filter((t) => t === 'estimate_food');
  if (extras.length !== 1) throw new Error('expected exactly one estimate_food entry');

  for (const k of contractKeys) {
    if (!flat.includes(k)) throw new Error(`Missing folder mapping for contract tool: ${k}`);
  }
  for (const k of flat) {
    if (k === 'estimate_food') continue;
    if (!contractKeys.includes(k)) throw new Error(`Unknown tool in FOLDER_TOOLS: ${k}`);
  }
}

function writeOneRequest(
  root: string,
  folder: string,
  toolName: string,
  seq: number,
  options: { rest: boolean },
): void {
  const dir = join(root, folder);
  mkdirSync(dir, { recursive: true });

  const baseFileName = options.rest ? (REST_FILE_NAMES[toolName] ?? toolName) : toolName;
  const infoName = options.rest ? (REST_INFO_NAMES[toolName] ?? toolName) : undefined;

  if (toolName === 'estimate_food') {
    const url = buildUrl('estimate_food', '/api/health/food/estimate');
    const body = BODY_JSON.estimate_food!;
    writeFileSync(
      join(dir, `${baseFileName}.yml`),
      renderRequest(toolName, seq, 'POST', url, body, infoName),
    );
    return;
  }

  const contract = mcpToolContracts[toolName];
  if (!contract) throw new Error(`No contract for ${toolName}`);

  const url = buildUrl(toolName, contract.path);

  let body: object | undefined;
  const wantsJsonBody =
    (contract.method === 'POST' || contract.method === 'PATCH') &&
    (contract.params === 'body' || contract.params === 'path+body');
  if (wantsJsonBody) {
    body = BODY_JSON[toolName];
    if (body === undefined) throw new Error(`Missing BODY_JSON for ${toolName}`);
  }

  writeFileSync(
    join(dir, `${baseFileName}.yml`),
    renderRequest(toolName, seq, contract.method, url, body, infoName),
  );
}

function generateMcpCollection(): void {
  for (const [folder, tools] of Object.entries(FOLDER_TOOLS)) {
    const dir = join(MCP_BRUNO_ROOT, folder);
    mkdirSync(dir, { recursive: true });

    let seq = 0;
    for (const toolName of tools) {
      seq += 1;
      writeOneRequest(MCP_BRUNO_ROOT, folder, toolName, seq, { rest: false });
    }
  }
  console.log(`Wrote Bruno requests under ${MCP_BRUNO_ROOT}`);
}

function generateRestCollection(): void {
  mkdirSync(REST_BRUNO_ROOT, { recursive: true });
  writeFileSync(join(REST_BRUNO_ROOT, 'folder.yml'), renderFolderYml('rest', REST_ROOT_FOLDER_SEQ));

  const folderNames = Object.keys(FOLDER_TOOLS);
  folderNames.forEach((folder, i) => {
    const sub = join(REST_BRUNO_ROOT, folder);
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(sub, 'folder.yml'), renderFolderYml(folder, i + 1));
  });

  for (const [folder, tools] of Object.entries(FOLDER_TOOLS)) {
    let seq = 0;
    for (const toolName of tools) {
      seq += 1;
      writeOneRequest(REST_BRUNO_ROOT, folder, toolName, seq, { rest: true });
    }
  }
  console.log(`Wrote Bruno requests under ${REST_BRUNO_ROOT}`);
}

function main(): void {
  validateMapping();
  generateMcpCollection();
  generateRestCollection();
}

main();
