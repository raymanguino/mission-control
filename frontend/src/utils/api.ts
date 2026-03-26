import type { ErrorEnvelope } from '@mission-control/types';

const BASE = import.meta.env['VITE_API_URL'] ?? '';

function getToken(): string | null {
  return localStorage.getItem('mc_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (options.body != null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('mc_token');
    window.location.href = '/login';
    throw new ApiError(401, 'UNAUTHORIZED', 'Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text();
    const parsed = parseErrorResponse(text);
    throw new ApiError(
      res.status,
      parsed.code ?? fallbackCode(res.status),
      parsed.message ?? `API error ${res.status}`,
      parsed.details,
    );
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(status: number, code: string | undefined, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
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

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
