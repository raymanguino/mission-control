// Thin wrapper for calling the mission-control backend REST API
import type { ErrorEnvelope } from '@mission-control/types';

const backendUrl = process.env['BACKEND_URL'] ?? 'http://localhost:3001';

let dashboardJwt: string | null = null;
let loginInFlight: Promise<string> | null = null;
let loginSeq = 0;

async function loginDashboard(): Promise<string> {
  const password = process.env['DASHBOARD_PASSWORD']?.trim();
  if (!password) {
    throw new Error(
      'DASHBOARD_PASSWORD is required (same value as backend DASHBOARD_PASSWORD; MCP logs in like the web dashboard)',
    );
  }
  const res = await fetch(`${backendUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Dashboard login failed (${res.status}): ${text}`);
  }
  let data: { token?: string };
  try {
    data = JSON.parse(text) as { token?: string };
  } catch {
    throw new Error(`Dashboard login returned invalid JSON: ${text}`);
  }
  if (!data.token) {
    throw new Error('Dashboard login response missing token');
  }
  return data.token;
}

async function getDashboardJwt(): Promise<string> {
  while (true) {
    if (dashboardJwt) return dashboardJwt;
    if (!loginInFlight) {
      const capturedSeq = loginSeq;
      loginInFlight = loginDashboard()
        .then((t) => {
          if (capturedSeq === loginSeq) {
            dashboardJwt = t;
          }
          return t;
        })
        .finally(() => {
          loginInFlight = null;
        });
    }
    await loginInFlight;
    if (dashboardJwt) return dashboardJwt;
  }
}

function invalidateDashboardJwt(): void {
  dashboardJwt = null;
  loginSeq += 1;
}

async function getDashboardAuthHeaders(): Promise<Record<string, string>> {
  const token = await getDashboardJwt();
  return { Authorization: `Bearer ${token}` };
}

async function withAuthRetry(doFetch: (auth: Record<string, string>) => Promise<Response>): Promise<Response> {
  let auth = await getDashboardAuthHeaders();
  let res = await doFetch(auth);
  if (res.status === 401) {
    invalidateDashboardJwt();
    auth = await getDashboardAuthHeaders();
    res = await doFetch(auth);
  }
  return res;
}

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
  const res = await withAuthRetry((auth) =>
    fetch(`${backendUrl}${path}`, {
      headers: { ...auth },
    }),
  );
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
  const res = await withAuthRetry(async (auth) => {
    const headers: Record<string, string> = {
      ...auth,
      'Content-Type': 'application/json',
    };
    if (options?.headers) Object.assign(headers, options.headers);

    return fetch(`${backendUrl}${path}`, {
      method: 'POST',
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
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
  const res = await withAuthRetry((auth) =>
    fetch(`${backendUrl}${path}`, {
      method: 'PATCH',
      headers: {
        ...auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  );
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
  const res = await withAuthRetry((auth) =>
    fetch(`${backendUrl}${path}`, {
      method: 'DELETE',
      headers: { ...auth },
    }),
  );
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
