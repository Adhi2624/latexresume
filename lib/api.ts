'use client';

export class ApiError extends Error {
  constructor(message: string, public status: number, public log?: string, public fields?: Record<string, string>) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status, body.log, body.fields);
  }
  return body.data as T;
}
