import { authed, ok, readJson } from '@/lib/http';
import { deleteResume, getResume, updateResume } from '@/lib/resumes';
import { updateResumeSchema } from '@/lib/validation';
import { guard } from '@/lib/http-resumes';

export const GET = authed((_req, s, p) => guard(async () => ok(await getResume(s.userId, p.id))));

export const PUT = authed((req, s, p) =>
  guard(async () => {
    const body = updateResumeSchema.parse(await readJson(req));
    return ok(await updateResume(s.userId, p.id, body));
  }),
);

export const DELETE = authed((_req, s, p) =>
  guard(async () => {
    await deleteResume(s.userId, p.id);
    return ok({ deleted: true });
  }),
);
