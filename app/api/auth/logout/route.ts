import { getSession, clearSessionCookie, revokeSessions } from '@/lib/auth';
import { ok } from '@/lib/http';

export async function POST() {
  const s = await getSession().catch(() => null);
  if (s) await revokeSessions(s.userId);
  else await clearSessionCookie();
  return ok({ loggedOut: true });
}
