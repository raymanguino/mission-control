import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiError, parseBody, registerErrorHandling } from './errors.js';

describe('error utilities', () => {
  it('parseBody returns validated payload', () => {
    const schema = z.object({ name: z.string() });
    const body = parseBody(schema, { name: 'Alpha' });
    expect(body).toEqual({ name: 'Alpha' });
  });

  it('parseBody throws ApiError with validation details', () => {
    const schema = z.object({ name: z.string().min(2) });

    try {
      parseBody(schema, { name: 'A' });
      throw new Error('expected parseBody to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.statusCode).toBe(400);
      expect(apiError.code).toBe('VALIDATION_FAILED');
      expect(apiError.details).toEqual(
        expect.objectContaining({
          fieldErrors: expect.any(Object),
          issues: expect.any(Array),
        }),
      );
    }
  });
});

describe('global error handling', () => {
  it('serializes ApiError using the standard envelope', async () => {
    const app = Fastify();
    registerErrorHandling(app);

    app.get('/api/boom', async () => {
      throw new ApiError(404, 'NOT_FOUND', 'Widget not found');
    });

    try {
      const res = await app.inject({ method: 'GET', url: '/api/boom' });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Widget not found',
        },
      });
    } finally {
      await app.close();
    }
  });

  it('hides internal error details for unknown failures', async () => {
    const app = Fastify();
    registerErrorHandling(app);

    app.get('/api/fail', async () => {
      throw new Error('database is down');
    });

    try {
      const res = await app.inject({ method: 'GET', url: '/api/fail' });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    } finally {
      await app.close();
    }
  });
});
