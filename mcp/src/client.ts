// Thin wrapper for calling the mission-control backend REST API
import type { ErrorEnvelope } from '@mission-control/types';

const backendUrl = process.env['BACKEND_URL'] ?? 'http://localhost:3001';
const backendToken = process.env['BACKEND_TOKEN'] ?? process.env['BACKEND_JWT'];

if (!backendToken) throw new Error('BACKEND_TOKEN or BACKEND_JWT is required');

export class BackendApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(status: number, code: string | undefined, message: string, details?: unknown) {
    super(message);
    this.name = 'BackendApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${backendUrl}${path}`, {
    headers: { Authorization: `Bearer ${backendToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    const parsed = parseErrorResponse(text);
    throw new BackendApiError(
      res.status,
      parsed.code ?? fallbackCode(res.status),
      parsed.message ?? `Backend ${path} failed (${res.status})`,
      parsed.details,
    );
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  options?: { headers?: Record<string, string> },
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${backendToken}`,
    'Content-Type': 'application/json',
  };
  if (options?.headers) Object.assign(headers, options.headers);

  const res = await fetch(`${backendUrl}${path}`, {
    method: 'POST',
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    const parsed = parseErrorResponse(text);
    throw new BackendApiError(
      res.status,
      parsed.code ?? fallbackCode(res.status),
      parsed.message ?? `Backend POST ${path} failed (${res.status})`,
      parsed.details,
    );
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${backendUrl}${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${backendToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    const parsed = parseErrorResponse(text);
    throw new BackendApiError(
      res.status,
      parsed.code ?? fallbackCode(res.status),
      parsed.message ?? `Backend PATCH ${path} failed (${res.status})`,
      parsed.details,
    );
  }
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${backendUrl}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${backendToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    const parsed = parseErrorResponse(text);
    throw new BackendApiError(
      res.status,
      parsed.code ?? fallbackCode(res.status),
      parsed.message ?? `Backend DELETE ${path} failed (${res.status})`,
      parsed.details,
    );
  }
}

function parseErrorResponse(
  responseText: string,
): { message?: string; code?: string; details?: unknown } {
  if (!responseText) return {};
  try {
    const parsed = JSON.parse(responseText) as Partial<ErrorEnvelope> & {
      error?: string | { message?: string; code?: string; details?: unknown };
      code?: string;
      details?: unknown;
      message?: string;
    };

    if (typeof parsed.error === 'string') {
      return {
        message: parsed.error,
        code: parsed.code,
        details: parsed.details,
      };
    }

    if (parsed.error && typeof parsed.error === 'object') {
      return {
        message: parsed.error.message,
        code: parsed.error.code,
        details: parsed.error.details,
      };
    }

    if (typeof parsed.message === 'string') {
      return {
        message: parsed.message,
        code: parsed.code,
        details: parsed.details,
      };
    }
  } catch {
    // Non-JSON error payloads are surfaced as plain text message fallback.
  }

  return { message: responseText };
}

function fallbackCode(status: number): string {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'BAD_REQUEST';
}
