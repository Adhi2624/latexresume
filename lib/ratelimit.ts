import { withDb } from './db';

/** Best-effort client IP (Cloudflare, then reverse proxies). */
export function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

/** 1 in production; 100 in development so repeated local/test runs aren't throttled. Override with RATE_LIMIT_SCALE. */
function rateScale(): number {
  const v = Number(process.env.RATE_LIMIT_SCALE);
  if (Number.isFinite(v) && v > 0) return v;
  return process.env.NODE_ENV === 'production' ? 1 : 100;
}

export class RateLimited extends Error {
  constructor(public retryAfter: number) {
    super('Too many requests. Please slow down and try again shortly.');
  }
}

/**
 * Fixed-window counter stored in MongoDB (works the same on Node and Workers).
 * Throws RateLimited when `limit` is exceeded within `windowSec`.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<void> {
  limit = Math.ceil(limit * rateScale());
  const now = Date.now();
  const windowId = Math.floor(now / (windowSec * 1000));
  const expiresAt = new Date((windowId + 2) * windowSec * 1000);
  const doc = await withDb(async (db) => {
    const c = db.collection<{ _id: string; n: number; expiresAt: Date }>('ratelimits');
    return c.findOneAndUpdate(
      { _id: `${key}:${windowId}` },
      { $inc: { n: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: 'after' },
    );
  });
  if ((doc?.n ?? 0) > limit) {
    throw new RateLimited(Math.max(1, Math.ceil(((windowId + 1) * windowSec * 1000 - now) / 1000)));
  }
}

/** Allows one in-flight operation per key; the lock self-expires after `ttlSec`. */
export async function acquireLock(key: string, ttlSec: number): Promise<boolean> {
  return withDb(async (db) => {
    const c = db.collection<{ _id: string; expiresAt: Date }>('locks');
    const now = new Date();
    try {
      const r = await c.findOneAndUpdate(
        { _id: key, expiresAt: { $lt: now } },
        { $set: { expiresAt: new Date(now.getTime() + ttlSec * 1000) } },
        { returnDocument: 'after' },
      );
      if (r) return true;
      await c.insertOne({ _id: key, expiresAt: new Date(now.getTime() + ttlSec * 1000) });
      return true;
    } catch (e: any) {
      if (e?.code === 11000) return false; // held by someone else
      throw e;
    }
  });
}

export async function releaseLock(key: string): Promise<void> {
  await withDb((db) => db.collection<{ _id: string }>('locks').deleteOne({ _id: key })).catch(() => {});
}
