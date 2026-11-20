import { withDb, col } from '@/lib/db';
import { createSessionToken, setSessionCookie } from '@/lib/auth';
import { verifyPassword } from '@/lib/security';
import { loginSchema } from '@/lib/validation';
import { fail, handleError, ok, readJson } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/ratelimit';

export async function POST(req: Request) {
  try {
    const body = loginSchema.parse(await readJson(req));
    const ip = clientIp(req);
    await rateLimit(`login-ip:${ip}`, 60, 600);
    await rateLimit(`login:${ip}:${body.email}`, 8, 600);
    // IP-independent: one account can't be brute-forced from many addresses.
    await rateLimit(`login-email:${body.email}`, 20, 900);
    const user = await withDb((db) => col.users(db).findOne({ email: body.email }));
    // Verify against a dummy hash when the user is unknown to keep timing similar.
    const valid = user
      ? await verifyPassword(body.password, user.passwordHash)
      : (await verifyPassword(body.password, 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAA'), false);
    if (!user || !valid) return fail('Invalid email or password', 401);
    await setSessionCookie(await createSessionToken({ userId: String(user._id), email: user.email, sv: user.sv ?? 0 }));
    return ok({ id: String(user._id), email: user.email, name: user.name });
  } catch (e) {
    return handleError(e);
  }
}
