import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_FAILED'
  | 'INTERNAL_ERROR';

export type ErrorEnvelope = {
  error: {
    message: string;
    code: ApiErrorCode;
    details?: unknown;
  };
};

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;
  public readonly details?: unknown;

  constructor(statusCode: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function createErrorEnvelope(
  message: string,
  code: ApiErrorCode,
  details?: unknown,
): ErrorEnvelope {
  return {
    error: {
      message,
      code,
      ...(details !== undefined ? { details } : {}),
    },
  };
}

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
) {
  return reply.code(statusCode).send(createErrorEnvelope(message, code, details));
}

export function parseBody<Schema extends z.ZodTypeAny>(schema: Schema, body: unknown): z.infer<Schema> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid body', buildValidationDetails(parsed.error));
  }
  return parsed.data;
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (reply.sent) return;

    if (error instanceof ApiError) {
      sendError(reply, error.statusCode, error.code, error.message, error.details);
      return;
    }

    if (error instanceof z.ZodError) {
      sendError(reply, 400, 'VALIDATION_FAILED', 'Invalid request', buildValidationDetails(error));
      return;
    }

    const statusCode = getStatusCode(error);
    if (statusCode >= 400 && statusCode < 500) {
      const code = mapStatusToCode(statusCode);
      const message = error instanceof Error ? error.message : 'Request failed';
      sendError(reply, statusCode, code, message);
      return;
    }

    request.log.error({ err: error }, 'Unhandled request error');
    sendError(reply, 500, 'INTERNAL_ERROR', 'Internal server error');
  });

  app.setNotFoundHandler((request, reply) => {
    sendError(reply, 404, 'NOT_FOUND', `Route ${request.method} ${request.url} not found`);
  });
}

function getStatusCode(error: unknown): number {
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
  ) {
    return error.statusCode;
  }
  return 500;
}

function mapStatusToCode(statusCode: number): ApiErrorCode {
  if (statusCode === 400) return 'BAD_REQUEST';
  if (statusCode === 401) return 'UNAUTHORIZED';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 409) return 'CONFLICT';
  return 'BAD_REQUEST';
}

function buildValidationDetails(error: z.ZodError) {
  const flattened = error.flatten();
  return {
    formErrors: flattened.formErrors,
    fieldErrors: flattened.fieldErrors,
    issues: error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path,
    })),
  };
}
