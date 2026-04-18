import type { FastifyPluginAsync } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { createGunzip } from 'zlib';
import * as os from 'os';

interface LogLine {
  time: string;
  level: number;
  levelLabel: string;
  msg: string;
  raw: string;
  pid?: number;
  hostname?: string;
  reqId?: string;
  req?: {
    method?: string;
    url?: string;
    host?: string;
    remoteAddress?: string;
    remotePort?: number;
  };
  res?: {
    statusCode?: number;
  };
  responseTime?: number;
  guildId?: string;
  err?: string;
}

interface LogQuery {
  from?: string;
  to?: string;
  level?: string;
  limit?: number;
  offset?: number;
}

const LOG_DIR = process.env.LOG_DIR || 'logs';
const LOG_FILE = process.env.LOG_FILE || 'backend.log';

const pinoLevels: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

function levelToLabel(level: number): string {
  const entry = Object.entries(pinoLevels).find(([, v]) => v === level);
  return entry ? entry[0] : 'unknown';
}

function getLogFilePath(): string {
  const logDir = path.resolve(process.cwd(), LOG_DIR);
  return path.join(logDir, LOG_FILE);
}

function getRotatedLogPaths(): string[] {
  const logDir = path.resolve(process.cwd(), LOG_DIR);
  const rotated: string[] = [];

  for (let i = 1; i <= 14; i++) {
    if (i === 1) {
      rotated.push(path.join(logDir, `backend.1.log`));
    } else {
      rotated.push(path.join(logDir, `backend.${i}.log.gz`));
    }
  }

  return rotated;
}

async function* readLinesFromFile(
  filePath: string,
  isGzip: boolean,
): AsyncGenerator<LogLine> {
  let input: NodeJS.ReadableStream;

  if (isGzip) {
    input = fs.createReadStream(filePath).pipe(createGunzip());
  } else {
    input = fs.createReadStream(filePath, { encoding: 'utf-8' });
  }

  const rl = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed.time && parsed.msg) {
        yield {
          time: parsed.time,
          level: parsed.level || 30,
          levelLabel: levelToLabel(parsed.level || 30),
          msg: parsed.msg,
          raw: line,
          pid: parsed.pid,
          hostname: parsed.hostname,
          reqId: parsed.reqId,
          req: parsed.req,
          res: parsed.res,
          responseTime: parsed.responseTime,
          guildId: parsed.guildId,
          err: parsed.err,
        };
      }
    } catch {
      // Skip invalid JSON lines
    }
  }
}

async function getAllLogLines(query: LogQuery): Promise<LogLine[]> {
  const { limit = 1000, offset = 0 } = query;

  const minLevel = query.level ? (pinoLevels[query.level] ?? 0) : 0;
  const fromTime = query.from ? new Date(query.from).getTime() : 0;
  const toTime = query.to ? new Date(query.to).getTime() : Date.now();

  const allLines: LogLine[] = [];

  // Read current log file
  const currentLogPath = getLogFilePath();
  if (fs.existsSync(currentLogPath)) {
    for await (const line of readLinesFromFile(currentLogPath, false)) {
      const lineTime = new Date(line.time).getTime();
      if (lineTime >= fromTime && lineTime <= toTime && line.level >= minLevel) {
        allLines.push(line);
      }
    }
  }

  // Read rotated log files
  for (const rotatedPath of getRotatedLogPaths()) {
    if (!fs.existsSync(rotatedPath)) continue;

    try {
      const isGzip = rotatedPath.endsWith('.gz');
      for await (const line of readLinesFromFile(rotatedPath, isGzip)) {
        const lineTime = new Date(line.time).getTime();
        if (lineTime >= fromTime && lineTime <= toTime && line.level >= minLevel) {
          allLines.push(line);
        }
      }
    } catch (err) {
      console.error(`Failed to read rotated log ${rotatedPath}:`, err);
    }
  }

  // Sort by timestamp descending (newest first)
  allLines.sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
  );

  // Apply pagination
  return allLines.slice(offset, offset + limit);
}

async function countLogLines(query: LogQuery): Promise<number> {
  const minLevel = query.level ? (pinoLevels[query.level] ?? 0) : 0;
  const fromTime = query.from ? new Date(query.from).getTime() : 0;
  const toTime = query.to ? new Date(query.to).getTime() : Date.now();

  let count = 0;

  // Count current log file
  const currentLogPath = getLogFilePath();
  if (fs.existsSync(currentLogPath)) {
    for await (const line of readLinesFromFile(currentLogPath, false)) {
      const lineTime = new Date(line.time).getTime();
      if (lineTime >= fromTime && lineTime <= toTime && line.level >= minLevel) {
        count++;
      }
    }
  }

  // Count rotated log files
  for (const rotatedPath of getRotatedLogPaths()) {
    if (!fs.existsSync(rotatedPath)) continue;

    try {
      const isGzip = rotatedPath.endsWith('.gz');
      for await (const line of readLinesFromFile(rotatedPath, isGzip)) {
        const lineTime = new Date(line.time).getTime();
        if (lineTime >= fromTime && lineTime <= toTime && line.level >= minLevel) {
          count++;
        }
      }
    } catch (err) {
      console.error(`Failed to count rotated log ${rotatedPath}:`, err);
    }
  }

  return count;
}

const logRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: fastify.authenticate }, async (request) => {
    const q = request.query as LogQuery;
    const limit = Math.min(q.limit ?? 1000, 5000);
    const offset = q.offset ?? 0;

    const lines = await getAllLogLines({ ...q, limit, offset });
    const total = await countLogLines(q);

    return {
      lines,
      total,
      hasMore: offset + lines.length < total,
    };
  });

  fastify.get(
    '/download',
    { preHandler: fastify.authenticate },
    async (request) => {
      const q = request.query as LogQuery;
      const lines = await getAllLogLines({ ...q, limit: 50000, offset: 0 });

      // Convert to raw log format
      const rawLogs = lines.map((l) => l.raw).join(os.EOL);

      return rawLogs;
    },
  );
};

export default logRoutes;