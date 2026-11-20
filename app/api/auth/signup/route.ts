import { ensureIndexes, withDb, col } from '@/lib/db';
import { createSessionToken, setSessionCookie, signupAllowed } from '@/lib/auth';
import { hashPassword } from '@/lib/security';
import { signupSchema } from '@/lib/validation';
import { fail, handleError, ok, readJson } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/ratelimit';

export async function POST(req: Request) {
  try {
    if (!signupAllowed()) return fail('Registration is disabled on this instance', 403);
    await rateLimit(`signup:${clientIp(req)}`, 10, 3600);
    await rateLimit('signup:global', 200, 3600);
    const body = signupSchema.parse(await readJson(req));
    const passwordHash = await hashPassword(body.password);
    const user = await withDb(async (db) => {
      await ensureIndexes(db);
      const doc = { email: body.email, name: body.name, passwordHash, createdAt: new Date() };
      try {
        const r = await col.users(db).insertOne(doc as never);
        return { _id: r.insertedId, ...doc };
      } catch (e: any) {
        if (e?.code === 11000) return null;
        throw e;
      }
    });
    if (!user) return fail('Email already registered', 409);
    await setSessionCookie(await createSessionToken({ userId: String(user._id), email: user.email }));
    return ok({ id: String(user._id), email: user.email, name: user.name }, 201);
  } catch (e) {
    return handleError(e);
  }
}
