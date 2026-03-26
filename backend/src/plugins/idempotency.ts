import crypto from 'crypto';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
  finalizeIdempotencyKey,
  reserveIdempotencyKey,
  type ReserveIdempotencyResult,
} from '../db/api/idempotency.js';
import {
  recordIdempotencyConflict,
  recordIdempotencyFinalized,
  recordIdempotencyInProgress,
  recordIdempotencyReplayed,
  recordIdempotencyReserved,
} from '../services/idempotency-metrics.js';

type IdempotencyContext = {
  recordId: string;
  key: string;
};

declare module 'fastify' {
  interface FastifyInstance {
    enforceIdempotency: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    finalizeIdempotency: (
      request: FastifyRequest,
      statusCode: number,
      responseBody: unknown,
    ) => Promise<void>;
  }

  interface FastifyRequest {
    idempotencyContext?: IdempotencyContext;
  }
}

type JsonLike = null | string | number | boolean | JsonLike[] | { [key: string]: JsonLike };

function sortJson(value: unknown): JsonLike {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sortJson(entry));
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    const result: { [key: string]: JsonLike } = {};
    for (const [key, entryValue] of entries) {
      result[key] = sortJson(entryValue);
    }
    return result;
  }

  return null;
}

function hashBody(body: unknown): string {
  const normalized = JSON.stringify(sortJson(body ?? null));
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function getScope(request: FastifyRequest): string {
  const requestWithAgent = request as FastifyRequest & { agent?: { id?: string } };
  if (requestWithAgent.agent?.id) {
    return `agent:${requestWithAgent.agent.id}`;
  }

  const requestWithUser = request as FastifyRequest & { user?: { sub?: string } };
  const sub = requestWithUser.user?.sub ?? 'dashboard';
  return `dashboard:${sub}`;
}

function getRoutePath(request: FastifyRequest): string {
  const routePath = request.routeOptions.url;
  return routePath || request.url.split('?')[0] || request.url;
}

function sendIdempotencyError(reply: FastifyReply, result: ReserveIdempotencyResult) {
  if (result.kind === 'conflict') {
    return reply.code(409).send({ error: 'Idempotency-Key has already been used with a different payload' });
  }

  return reply.code(409).send({ error: 'A request with this Idempotency-Key is already in progress' });
}

const idempotencyPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate(
    'enforceIdempotency',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const rawHeader = request.headers['idempotency-key'];
      if (typeof rawHeader !== 'string') {
        return;
      }

      const key = rawHeader.trim();
      if (!key) {
        await reply.code(400).send({ error: 'Idempotency-Key cannot be empty' });
        return;
      }

      const method = request.method.toUpperCase();
      const path = getRoutePath(request);
      const scope = getScope(request);
      const requestHash = hashBody(request.body);

      const result = await reserveIdempotencyKey({
        scope,
        idempotencyKey: key,
        method,
        path,
        requestHash,
      });

      if (result.kind === 'replay') {
        recordIdempotencyReplayed();
        await reply.code(result.statusCode).send(result.responseBody);
        return;
      }

      if (result.kind === 'conflict' || result.kind === 'in_progress') {
        if (result.kind === 'conflict') {
          recordIdempotencyConflict();
        } else {
          recordIdempotencyInProgress();
        }
        await sendIdempotencyError(reply, result);
        return;
      }

      recordIdempotencyReserved();
      request.idempotencyContext = {
        recordId: result.recordId,
        key,
      };
    },
  );

  fastify.decorate(
    'finalizeIdempotency',
    async (
      request: FastifyRequest,
      statusCode: number,
      responseBody: unknown,
    ): Promise<void> => {
      const recordId = request.idempotencyContext?.recordId;
      if (!recordId) return;
      await finalizeIdempotencyKey(recordId, statusCode, responseBody);
      recordIdempotencyFinalized();
    },
  );
};

export default fp(idempotencyPlugin, { name: 'idempotency' });
