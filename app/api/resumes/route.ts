import { authed, ok, readJson } from '@/lib/http';
import { createResume, listResumes } from '@/lib/resumes';
import { createResumeSchema } from '@/lib/validation';
import { guard } from '@/lib/http-resumes';

export const GET = authed(async (_req, s) => ok(await listResumes(s.userId)));

export const POST = authed((req, s) =>
  guard(async () => {
    const body = createResumeSchema.parse(await readJson(req));
    return ok(await createResume(s.userId, body), 201);
  }),
);
