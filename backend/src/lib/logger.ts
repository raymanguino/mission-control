import { join } from 'path';

const LOG_DIR = process.env['LOG_DIR'] ?? 'logs';
const LOG_FILE = process.env['LOG_FILE'] ?? 'backend.log';

/**
 * Returns a pino logger configuration for Fastify's `logger` option.
 *
 * Logs are written as JSON to rolling files in LOG_DIR:
 * - Rotated daily (or at 100 MB, whichever comes first)
 * - gzip compressed after rotation
 * - Retained for 14 days max
 *
 * For pretty terminal output during development, pipe through pino-pretty:
 *   pnpm dev | pino-pretty
 */
export function loggerConfig() {
  return {
    level: process.env['LOG_LEVEL'] ?? 'info',
    transport: {
      target: 'pino-roll',
      options: {
        file: join(LOG_DIR, LOG_FILE),
        frequency: 'daily',
        maxSize: '100m',
        maxFiles: 14,
        mkdir: true,
        extension: 'log',
        compress: 'gzip',
      },
    },
  };
}
