import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { col, withDb } from './db';
import { requireSecret, sha256Hex } from './security';

export const SESSION_COOKIE = 'lr_session';
const SESSION_DAYS = 14;

export interface Session {
  userId: string;
  email: string;
  /** Session version; must match the user's current `sv`. */
  sv?: number;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(requireSecret('JWT_SECRET'));
}

export async function createSessionToken(s: Session): Promise<string> {
  return new SignJWT({ email: s.email, sv: s.sv ?? 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(s.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: '/',
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Signs the user out everywhere: deletes the cookie and invalidates every issued session token. */
export async function revokeSessions(userId: string) {
  await withDb((db) => col.users(db).updateOne({ _id: new ObjectId(userId) }, { $inc: { sv: 1 } }));
  await clearSessionCookie();
}

async function sessionFromCookie(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (!payload.sub) return null;
    // Revocation: logout bumps the user's `sv`, invalidating older cookies.
    const user = await withDb((db) =>
      col.users(db).findOne({ _id: new ObjectId(payload.sub) }, { projection: { email: 1, sv: 1 } }),
    );
    if (!user || (user.sv ?? 0) !== Number(payload.sv ?? 0)) return null;
    return { userId: payload.sub, email: user.email };
  } catch {
    return null;
  }
}

async function sessionFromBearer(req: Request): Promise<Session | null> {
  const h = req.headers.get('authorization');
  const m = h?.match(/^Bearer\s+(lrp_[A-Za-z0-9]+)$/);
  if (!m) return null;
  const hash = await sha256Hex(m[1]);
  return withDb(async (db) => {
    const t = await col.tokens(db).findOneAndUpdate(
      { tokenHash: hash },
      { $set: { lastUsedAt: new Date() } },
    );
    if (!t) return null;
    const u = await col.users(db).findOne({ _id: new ObjectId(t.userId) });
    return u ? { userId: String(u._id), email: u.email } : null;
  });
}

/** Cookie session, or (when a Request is passed) an `Authorization: Bearer lrp_…` API token. */
export async function getSession(req?: Request): Promise<Session | null> {
  const fromCookie = await sessionFromCookie();
  if (fromCookie) return fromCookie;
  return req ? sessionFromBearer(req) : null;
}

export function signupAllowed(): boolean {
  return process.env.ALLOW_SIGNUP !== 'false';
}
