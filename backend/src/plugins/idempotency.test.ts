import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import idempotencyPlugin from './idempotency.js';
import { finalizeIdempotencyKey, reserveIdempotencyKey } from '../db/api/idempotency.js';

vi.mock('../db/api/idempotency.js', () => ({
  reserveIdempotencyKey: vi.fn(),
  finalizeIdempotencyKey: vi.fn(),
}));

const reserveMock = vi.mocked(reserveIdempotencyKey);
const finalizeMock = vi.mocked(finalizeIdempotencyKey);

async function buildApp() {
  const app = Fastify();

  app.decorate('authenticate', async (request) => {
    (request as { user?: { sub: string } }).user = { sub: 'dashboard' };
  });
  app.decorate('authenticateAgent', async () => {});

  await app.register(idempotencyPlugin);

  app.post('/projects', { preHandler: [app.authenticate, app.enforceIdempotency] }, async (request, reply) => {
    const body = request.body as { name: string };
    const response = { id: 'project-1', name: body.name };
    await app.finalizeIdempotency(request, 201, response);
    return reply.code(201).send(response);
  });

  return app;
}

describe('idempotency plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not apply idempotency when header is missing', async () => {
    const app = await buildApp();

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/projects',
        payload: { name: 'Alpha' },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({ id: 'project-1', name: 'Alpha' });
      expect(reserveMock).not.toHaveBeenCalled();
      expect(finalizeMock).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('replays existing response when key already completed', async () => {
    reserveMock.mockResolvedValueOnce({
      kind: 'replay',
      recordId: 'row-1',
      requestHash: 'hash-1',
      statusCode: 201,
      responseBody: { id: 'project-existing', name: 'Alpha' },
    });

    const app = await buildApp();

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/projects',
        headers: { 'idempotency-key': 'abc123' },
        payload: { name: 'Alpha' },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({ id: 'project-existing', name: 'Alpha' });
      expect(finalizeMock).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('returns conflict for same key with different payload', async () => {
    reserveMock.mockResolvedValueOnce({
      kind: 'conflict',
      recordId: 'row-1',
      requestHash: 'hash-existing',
      statusCode: 201,
      responseBody: { id: 'project-existing', name: 'Alpha' },
    });

    const app = await buildApp();

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/projects',
        headers: { 'idempotency-key': 'abc123' },
        payload: { name: 'Beta' },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({
        error: 'Idempotency-Key has already been used with a different payload',
      });
      expect(finalizeMock).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('returns conflict while a matching request is in progress', async () => {
    reserveMock.mockResolvedValueOnce({
      kind: 'in_progress',
      recordId: 'row-1',
      requestHash: 'hash-existing',
      statusCode: null,
      responseBody: null,
    });

    const app = await buildApp();

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/projects',
        headers: { 'idempotency-key': 'abc123' },
        payload: { name: 'Alpha' },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({
        error: 'A request with this Idempotency-Key is already in progress',
      });
      expect(finalizeMock).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('finalizes reserved requests after successful handler execution', async () => {
    reserveMock.mockResolvedValueOnce({
      kind: 'reserved',
      recordId: 'row-1',
      requestHash: 'hash-new',
      statusCode: null,
      responseBody: null,
    });

    const app = await buildApp();

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/projects',
        headers: { 'idempotency-key': 'abc123' },
        payload: { name: 'Alpha' },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({ id: 'project-1', name: 'Alpha' });
      expect(finalizeMock).toHaveBeenCalledTimes(1);
      expect(finalizeMock).toHaveBeenCalledWith('row-1', 201, { id: 'project-1', name: 'Alpha' });
    } finally {
      await app.close();
    }
  });
});
