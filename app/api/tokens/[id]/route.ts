import { ObjectId } from 'mongodb';
import { authed, fail, ok } from '@/lib/http';
import { col, toObjectId, withDb } from '@/lib/db';

export const DELETE = authed(async (_req, s, p) => {
  const id = toObjectId(p.id);
  if (!id) return fail('Not found', 404);
  const r = await withDb((db) => col.tokens(db).deleteOne({ _id: id, userId: new ObjectId(s.userId) }));
  return r.deletedCount ? ok({ deleted: true }) : fail('Not found', 404);
});
