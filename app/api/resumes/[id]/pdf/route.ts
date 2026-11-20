import { authed, fail } from '@/lib/http';
import { getPdf } from '@/lib/resumes';
import { guard } from '@/lib/http-resumes';

export const GET = authed((_req, s, p) =>
  guard(async () => {
    const pdf = await getPdf(s.userId, p.id);
    if (!pdf) return fail('No compiled PDF yet', 404);
    return new Response(pdf as BodyInit, {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'inline; filename="resume.pdf"',
        'cache-control': 'no-store',
      },
    });
  }),
);
