import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSession, type Session } from './auth';
import { RateLimited } from './ratelimit';

export const ok = <T>(data: T, status = 200) => NextResponse.json({ success: true, data }, { status });
export const fail = (error: string, status = 400) =>
  NextResponse.json({ success: false, error }, { status });

type Ctx = { params: Promise<Record<string, string>> };

/** Wraps a route handler with auth + uniform error handling. */
export function authed(
  handler: (req: Request, session: Session, params: Record<string, string>) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      const session = await getSession(req);
      if (!session) return fail('Unauthorized', 401);
      return await handler(req, session, await ctx.params);
    } catch (e) {
      return handleError(e);
    }
  };
}

/** Parses a JSON body; throws BadRequest (→ 400) on malformed JSON instead of silently using {}. */
export class BadRequest extends Error {}
export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BadRequest('Invalid JSON body');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BadRequest('JSON body must be an object');
  }
  return parsed;
}

export function handleError(e: unknown): Response {
  if (e instanceof BadRequest) return fail(e.message, 400);
  if (e instanceof RateLimited) {
    return NextResponse.json({ success: false, error: e.message }, { status: 429, headers: { 'retry-after': String(e.retryAfter) } });
  }
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const i of e.issues) fields[String(i.path[0] ?? '_')] ??= i.message;
    return NextResponse.json(
      { success: false, error: e.issues[0]?.message ?? 'Validation failed', fields },
      { status: 422 },
    );
  }
  console.error(e);
  return fail('Internal server error', 500);
}
