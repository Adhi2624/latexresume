import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { authed, fail, ok, readJson } from '@/lib/http';
import { col, toObjectId, withDb } from '@/lib/db';
import { AiBadUrl, AiNotConfigured, chatWithResume } from '@/lib/ai';
import { guard } from '@/lib/http-resumes';
import { NotFound } from '@/lib/resumes';

const bodySchema = z.object({ message: z.string().trim().min(1, 'Message is required').max(8000) });

async function owned(userId: string, id: string) {
  const rid = toObjectId(id);
  if (!rid) throw new NotFound();
  const r = await withDb((db) => col.resumes(db).findOne({ _id: rid, userId: new ObjectId(userId) }));
  if (!r) throw new NotFound();
  return r;
}

export const GET = authed((_req, s, p) =>
  guard(async () => {
    const r = await owned(s.userId, p.id);
    const msgs = await withDb((db) =>
      col.chats(db).find({ resumeId: r._id }).sort({ createdAt: 1 }).limit(200).toArray(),
    );
    return ok(msgs.map((m) => ({ id: String(m._id), role: m.role, content: m.content, createdAt: m.createdAt })));
  }),
);

export const POST = authed((req, s, p) =>
  guard(async () => {
    const { message } = bodySchema.parse(await readJson(req));
    const r = await owned(s.userId, p.id);
    const user = await withDb((db) => col.users(db).findOne({ _id: new ObjectId(s.userId) }));
    if (!user) return fail('Unauthorized', 401);

    const recent = await withDb((db) =>
      col.chats(db).find({ resumeId: r._id }).sort({ createdAt: -1 }).limit(10).toArray(),
    );
    const history = [
      ...recent.reverse().map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message },
    ];

    let reply: string;
    try {
      reply = await chatWithResume(user, r.latexSource, history);
    } catch (e) {
      if (e instanceof AiNotConfigured || e instanceof AiBadUrl) return fail(e.message, 400);
      console.error('AI error', e);
      return fail('The AI provider returned an error. Check your API key, model name and base URL in Settings.', 502);
    }
    const now = new Date();
    const res = await withDb((db) =>
      col.chats(db).insertMany([
        { resumeId: r._id, userId: new ObjectId(s.userId), role: 'user', content: message, createdAt: now },
        { resumeId: r._id, userId: new ObjectId(s.userId), role: 'assistant', content: reply, createdAt: new Date(now.getTime() + 1) },
      ] as never),
    );
    return ok({ id: String(res.insertedIds[1]), role: 'assistant', content: reply, createdAt: now });
  }),
);

export const DELETE = authed((_req, s, p) =>
  guard(async () => {
    const r = await owned(s.userId, p.id);
    await withDb((db) => col.chats(db).deleteMany({ resumeId: r._id }));
    return ok({ cleared: true });
  }),
);
