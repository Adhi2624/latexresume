import { ObjectId } from 'mongodb';
import { getSession, signupAllowed } from '@/lib/auth';
import { col, withDb } from '@/lib/db';
import { fail, handleError, ok } from '@/lib/http';

export async function GET() {
  try {
    const s = await getSession();
    if (!s) return Response.json({ success: false, error: 'Unauthorized', signupAllowed: signupAllowed() }, { status: 401 });
    const user = await withDb((db) => col.users(db).findOne({ _id: new ObjectId(s.userId) }));
    if (!user) return fail('Unauthorized', 401);
    return ok({ id: String(user._id), email: user.email, name: user.name });
  } catch (e) {
    return handleError(e);
  }
}
