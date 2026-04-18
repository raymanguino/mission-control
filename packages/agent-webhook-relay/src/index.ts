import { createHash, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type RelayRole = 'cos' | 'eng' | 'qa';
export type RelayStatus = 'pending' | 'processing' | 'retry' | 'delivered' | 'failed';

export interface RelayRecord {
  id: string;
  role: RelayRole;
  path: string;
  rawBody: string;
  headers: Record<string, string>;
  bodySha256: string;
  receivedAt: string;
  attempts: number;
  nextAttemptAt: number;
  status: RelayStatus;
  lastError?: string;
  deliveredAt?: string;
}

interface RelayConfig {
  host: string;
  port: number;
  enabledRoles: Set<RelayRole>;
  roleTokens: Partial<Record<RelayRole, string>>;
  openclawCmd: string;
  stateDir: string;
  maxAttempts: number;
  retryBaseMs: number;
  retryMaxMs: number;
  deliveryTimeoutMs: number;
}

const DEFAULT_HOST = process.env.MC_WEBHOOK_HOST ?? '127.0.0.1';
const DEFAULT_PORT = Number.parseInt(process.env.MC_WEBHOOK_PORT ?? '48123', 10);
const DEFAULT_ENABLED_ROLES = parseRoleList(process.env.MC_WEBHOOK_ENABLED_ROLES ?? 'cos');
const DEFAULT_STATE_DIR = process.env.MC_WEBHOOK_STATE_DIR ?? path.join(process.cwd(), 'state', 'agent-webhook-relay');
const DEFAULT_OPENCLAW_CMD = process.env.OPENCLAW_CMD ?? 'openclaw';
const DEFAULT_MAX_ATTEMPTS = Number.parseInt(process.env.MC_WEBHOOK_MAX_ATTEMPTS ?? '5', 10);
const DEFAULT_RETRY_BASE_MS = Number.parseInt(process.env.MC_WEBHOOK_RETRY_BASE_MS ?? '2000', 10);
const DEFAULT_RETRY_MAX_MS = Number.parseInt(process.env.MC_WEBHOOK_RETRY_MAX_MS ?? '300000', 10);
const DEFAULT_DELIVERY_TIMEOUT_MS = Number.parseInt(process.env.MC_WEBHOOK_DELIVERY_TIMEOUT_MS ?? '30000', 10);

const ROLE_PREFIX = '/hooks/mc';

/** Map event prefixes to roles. CoS handles `project.pending_approval` and `project.review_completed`. */
function inferRoleFromEvent(event: string): RelayRole | null {
  if (event.startsWith('project.pending_approval') || event.startsWith('project.review_completed')) {
    return 'cos';
  }
  if (event.startsWith('project.backlog_updated')) return 'eng';
  if (event.startsWith('project.all_tasks_completed')) return 'qa';
  return null;
}
const WORKER_INTERVAL_MS = 500;

const config: RelayConfig = {
  host: DEFAULT_HOST,
  port: Number.isFinite(DEFAULT_PORT) ? DEFAULT_PORT : 48123,
  enabledRoles: DEFAULT_ENABLED_ROLES,
  roleTokens: {
    cos: normalizeToken(process.env.MC_WEBHOOK_TOKEN_COS),
    eng: normalizeToken(process.env.MC_WEBHOOK_TOKEN_ENG),
    qa: normalizeToken(process.env.MC_WEBHOOK_TOKEN_QA),
  },
  openclawCmd: DEFAULT_OPENCLAW_CMD,
  stateDir: DEFAULT_STATE_DIR,
  maxAttempts: Number.isFinite(DEFAULT_MAX_ATTEMPTS) ? DEFAULT_MAX_ATTEMPTS : 5,
  retryBaseMs: Number.isFinite(DEFAULT_RETRY_BASE_MS) ? DEFAULT_RETRY_BASE_MS : 2000,
  retryMaxMs: Number.isFinite(DEFAULT_RETRY_MAX_MS) ? DEFAULT_RETRY_MAX_MS : 300000,
  deliveryTimeoutMs: Number.isFinite(DEFAULT_DELIVERY_TIMEOUT_MS) ? DEFAULT_DELIVERY_TIMEOUT_MS : 30000,
};

const dirs = {
  root: config.stateDir,
  queue: path.join(config.stateDir, 'queue'),
  processing: path.join(config.stateDir, 'processing'),
  delivered: path.join(config.stateDir, 'delivered'),
  failed: path.join(config.stateDir, 'failed'),
  logs: path.join(config.stateDir, 'relay.jsonl'),
};

let stopping = false;
let workerTimer: NodeJS.Timeout | null = null;
let busy = false;

export function parseRoleList(value: string): Set<RelayRole> {
  return new Set(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .filter((entry): entry is RelayRole => entry === 'cos' || entry === 'eng' || entry === 'qa'),
  );
}

export function normalizeToken(token: string | undefined): string | undefined {
  const trimmed = token?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function parseBearerToken(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const [scheme, ...rest] = value.split(/\s+/);
  if (!scheme || scheme.toLowerCase() !== 'bearer') return undefined;
  return rest.join(' ').trim() || undefined;
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function utcNow(): string {
  return new Date().toISOString();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function jitter(ms: number): number {
  const cap = Math.max(0, Math.min(1000, Math.floor(ms * 0.1)));
  return cap > 0 ? Math.floor(Math.random() * (cap + 1)) : 0;
}

export function backoffMs(attempts: number): number {
  const raw = config.retryBaseMs * 2 ** Math.max(0, attempts - 1);
  return Math.min(config.retryMaxMs, raw) + jitter(raw);
}

export function isRoleEnabled(role: string): role is RelayRole {
  return config.enabledRoles.has(role as RelayRole) && (role === 'cos' || role === 'eng' || role === 'qa');
}

export function extractRoleFromPath(requestPath: string): RelayRole | null {
  // All role events now arrive at /hooks/mc; role is inferred from the event field in the body.
  return requestPath === ROLE_PREFIX || requestPath === `${ROLE_PREFIX}/` ? null : null;
}

export function getTokenForRole(role: RelayRole): string | undefined {
  return config.roleTokens[role];
}

export function compareTokens(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

async function ensureDirs(): Promise<void> {
  await mkdir(dirs.root, { recursive: true });
  await mkdir(dirs.queue, { recursive: true });
  await mkdir(dirs.processing, { recursive: true });
  await mkdir(dirs.delivered, { recursive: true });
  await mkdir(dirs.failed, { recursive: true });
}

async function logJson(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown>): Promise<void> {
  const line = JSON.stringify({ ts: utcNow(), level, event, ...fields });
  await writeFile(dirs.logs, `${line}\n`, { flag: 'a' });
  console.log(line);
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(tmpPath, filePath);
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function moveJson(from: string, to: string): Promise<void> {
  try {
    await rename(from, to);
  } catch (error) {
    await rm(to, { force: true });
    await rename(from, to).catch((renameError) => {
      throw renameError instanceof Error ? renameError : error;
    });
  }
}

async function listRecordPaths(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => path.join(dir, entry.name));
}

async function loadQueueRecords(): Promise<Array<{ filePath: string; record: RelayRecord }>> {
  const filePaths = await listRecordPaths(dirs.queue);
  const records = await Promise.all(
    filePaths.map(async (filePath) => ({
      filePath,
      record: await readJson<RelayRecord>(filePath),
    })),
  );
  return records.sort((a, b) => a.record.receivedAt.localeCompare(b.record.receivedAt));
}

async function saveQueueRecord(record: RelayRecord): Promise<void> {
  await writeJsonAtomic(path.join(dirs.queue, `${record.id}.json`), record);
}

async function moveToState(filePath: string, targetDir: string, record: RelayRecord): Promise<void> {
  const targetPath = path.join(targetDir, `${record.id}.json`);
  await moveJson(filePath, targetPath);
  await writeJsonAtomic(targetPath, record);
}

async function deliverViaOpenClaw(record: RelayRecord): Promise<{ stdout: string; stderr: string; code: number }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      config.openclawCmd,
      [
        'system',
        'event',
        '--text',
        record.rawBody,
        '--mode',
        'now',
        '--timeout',
        String(config.deliveryTimeoutMs),
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

async function processOne(filePath: string, record: RelayRecord): Promise<void> {
  const attempt = record.attempts + 1;
  record.status = 'processing';
  record.attempts = attempt;
  await saveQueueRecord(record);

  await logJson('info', 'dispatch_attempt', {
    requestId: record.id,
    role: record.role,
    attempt,
    path: record.path,
    bodySha256: record.bodySha256,
  });

  const result = await deliverViaOpenClaw(record);
  if (result.code === 0) {
    record.status = 'delivered';
    record.deliveredAt = utcNow();
    record.lastError = '';
    await moveToState(filePath, dirs.delivered, record);
    await logJson('info', 'dispatch_delivered', {
      requestId: record.id,
      role: record.role,
      attempt,
      stdout: trim(result.stdout),
      stderr: trim(result.stderr),
    });
    return;
  }

  const errorText = `exit=${result.code} stderr=${trim(result.stderr)} stdout=${trim(result.stdout)}`;
  if (attempt >= config.maxAttempts) {
    record.status = 'failed';
    record.lastError = errorText;
    await moveToState(filePath, dirs.failed, record);
    await logJson('error', 'dispatch_failed', {
      requestId: record.id,
      role: record.role,
      attempt,
      error: errorText,
    });
    return;
  }

  const delay = backoffMs(attempt);
  record.status = 'retry';
  record.lastError = errorText;
  record.nextAttemptAt = Date.now() + delay;
  await saveQueueRecord(record);
  await logJson('warn', 'dispatch_retry', {
    requestId: record.id,
    role: record.role,
    attempt,
    retryInMs: delay,
    error: errorText,
  });
}

async function workerLoop(): Promise<void> {
  if (busy || stopping) return;
  busy = true;
  try {
    const records = await loadQueueRecords();
    const now = Date.now();
    for (const { filePath, record } of records) {
      if (stopping) break;
      if (record.status === 'processing') {
        // crash recovery, put it back in queue for the next pass
        record.status = 'retry';
        await saveQueueRecord(record);
      }
      if ((record.status === 'pending' || record.status === 'retry') && record.nextAttemptAt <= now) {
        await processOne(filePath, record);
      }
    }
  } catch (error) {
    await logJson('error', 'worker_error', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    busy = false;
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = `${JSON.stringify(payload)}\n`;
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function trim(value: string, maxChars = 2000): string {
  const text = value.trim();
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1)}…`;
}

function requireAuthorized(req: IncomingMessage, role: RelayRole): boolean {
  const expected = getTokenForRole(role);
  if (!expected) return true;
  const actual = parseBearerToken(req.headers.authorization);
  if (!actual) return false;
  return compareTokens(expected, actual);
}

function countFiles(dir: string): Promise<number> {
  return readdir(dir, { withFileTypes: true }).then((entries) => entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).length);
}

async function healthz(): Promise<Record<string, unknown>> {
  const [pending, delivered, failed] = await Promise.all([
    countFiles(dirs.queue),
    countFiles(dirs.delivered),
    countFiles(dirs.failed),
  ]);
  return {
    ok: true,
    service: 'agent-webhook-relay',
    enabledRoles: Array.from(config.enabledRoles),
    queue: { pending, delivered, failed },
  };
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const requestPath = req.url ? new URL(req.url, 'http://localhost').pathname : '/';
  if (req.method === 'GET' && requestPath === '/healthz') {
    sendJson(res, 200, await healthz());
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 404, { ok: false, error: 'not found' });
    return;
  }

  const rawBody = await readBody(req);
  if (!rawBody.trim()) {
    sendJson(res, 400, { ok: false, error: 'empty body' });
    return;
  }

  let parsedBody: Record<string, unknown>;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    sendJson(res, 400, { ok: false, error: 'invalid json' });
    return;
  }

  const event = typeof parsedBody['event'] === 'string' ? parsedBody['event'] : '';
  const role = inferRoleFromEvent(event);

  if (!role) {
    await logJson('warn', 'unknown_event', { event, path: requestPath });
    sendJson(res, 400, { ok: false, error: 'unknown event' });
    return;
  }

  if (!isRoleEnabled(role)) {
    await logJson('warn', 'role_disabled', { role, path: requestPath });
    sendJson(res, 404, { ok: false, error: 'role not enabled' });
    return;
  }

  if (!requireAuthorized(req, role)) {
    await logJson('warn', 'auth_failed', { role, path: requestPath, remote: req.socket.remoteAddress });
    sendJson(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  const requestId = cryptoRandomId();
  const record: RelayRecord = {
    id: requestId,
    role,
    path: requestPath,
    rawBody,
    headers: Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value ?? ''])),
    bodySha256: sha256(rawBody),
    receivedAt: utcNow(),
    attempts: 0,
    nextAttemptAt: Date.now(),
    status: 'pending',
  };

  await saveQueueRecord(record);
  await logJson('info', 'received', {
    requestId,
    role,
    path: requestPath,
    bodySha256: record.bodySha256,
    bodyBytes: Buffer.byteLength(rawBody, 'utf8'),
    remote: req.socket.remoteAddress,
  });

  sendJson(res, 202, { ok: true, requestId, role, status: 'queued' });
}

function cryptoRandomId(): string {
  return createHash('sha256')
    .update(`${process.pid}:${Date.now()}:${Math.random()}:${process.hrtime.bigint()}`)
    .digest('hex')
    .slice(0, 24);
}

async function main(): Promise<void> {
  await ensureDirs();
  await logJson('info', 'server_start', {
    host: config.host,
    port: config.port,
    enabledRoles: Array.from(config.enabledRoles),
    stateDir: config.stateDir,
    openclawCmd: config.openclawCmd,
  });

  const server = createServer((req, res) => {
    handleRequest(req, res).catch(async (error) => {
      await logJson('error', 'request_error', {
        error: error instanceof Error ? error.message : String(error),
      });
      if (!res.headersSent) {
        sendJson(res, 500, { ok: false, error: 'internal server error' });
      } else {
        res.end();
      }
    });
  });

  server.listen(config.port, config.host);
  workerTimer = setInterval(() => {
    workerLoop().catch(async (error) => {
      await logJson('error', 'worker_loop_error', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, WORKER_INTERVAL_MS);

  const shutdown = async (signalName: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    if (workerTimer) clearInterval(workerTimer);
    await logJson('info', 'server_shutdown_requested', { signal: signalName });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await logJson('info', 'server_stopped', {});
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT').finally(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM').finally(() => process.exit(0));
  });

  // fire an initial pass so any stale queue items are handled immediately
  await workerLoop();
}

if (import.meta.url === `file://${fileURLToPath(import.meta.url)}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
