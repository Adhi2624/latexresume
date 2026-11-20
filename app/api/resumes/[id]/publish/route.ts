import { authed, ok } from '@/lib/http';
import { publishResume, unpublishResume } from '@/lib/resumes';
import { guard } from '@/lib/http-resumes';

export const POST = authed((_req, s, p) => guard(async () => ok(await publishResume(s.userId, p.id))));
export const DELETE = authed((_req, s, p) => guard(async () => ok(await unpublishResume(s.userId, p.id))));
