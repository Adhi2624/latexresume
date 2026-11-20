import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { authed, ok, readJson } from '@/lib/http';
import { col, withDb } from '@/lib/db';
import { randomToken, sha256Hex } from '@/lib/security';

export const GET = authed(async (_req, s) => {
  const t = await withDb((db) => col.tokens(db).find({ userId: new ObjectId(s.userId) }).sort({ createdAt: -1 }).toArray());
  return ok(t.map((x) => ({ id: String(x._id), name: x.name, prefix: x.prefix, createdAt: x.createdAt, lastUsedAt: x.lastUsedAt })));
});

export const POST = authed(async (req, s) => {
  const { name } = z.object({ name: z.string().trim().min(1, 'Name is required').max(60) }).parse(await readJson(req));
  const token = `lrp_${randomToken(24)}`;
  const doc = { userId: new ObjectId(s.userId), name, tokenHash: await sha256Hex(token), prefix: token.slice(0, 8), createdAt: new Date() };
  const r = await withDb((db) => col.tokens(db).insertOne(doc as never));
  // The plaintext token is shown exactly once.
  return ok({ id: String(r.insertedId), name, prefix: doc.prefix, token }, 201);
});
