// Thin wrapper for calling the mission-control backend REST API

const backendUrl = process.env['BACKEND_URL'] ?? 'http://localhost:3001';
const jwt = process.env['BACKEND_JWT'];

if (!jwt) throw new Error('BACKEND_JWT is required');

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${backendUrl}${path}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) throw new Error(`Backend ${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  options?: { headers?: Record<string, string> },
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${jwt}`,
    'Content-Type': 'application/json',
  };
  if (options?.headers) Object.assign(headers, options.headers);

  const res = await fetch(`${backendUrl}${path}`, {
    method: 'POST',
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Backend POST ${path} → ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${backendUrl}${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Backend PATCH ${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}
