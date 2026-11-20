import { authed, fail, readJson } from '@/lib/http';
import { compileResume } from '@/lib/resumes';
import { guard } from '@/lib/http-resumes';

/** Compiles can wait for a cold-started compiler service (e.g. Render free tier). */
export const maxDuration = 60;

/** Returns the PDF bytes on success; JSON `{success:false,error,log}` (HTTP 422) on a TeX error. */
export const POST = authed((req, s, p) =>
  guard(async () => {
    const body = (await readJson(req)) as { latexSource?: unknown };
    const source = typeof body.latexSource === 'string' ? body.latexSource : undefined;
    const r = await compileResume(s.userId, p.id, source);
    if (!r.ok) {
      if (r.busy) {
        return Response.json({ success: false, error: r.error }, { status: 503, headers: { 'retry-after': '5' } });
      }
      return Response.json({ success: false, error: r.error, log: r.log }, { status: 422 });
    }
    return new Response(r.pdf as BodyInit, {
      headers: { 'content-type': 'application/pdf', 'cache-control': 'no-store' },
    });
  }),
);
