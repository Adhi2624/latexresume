import { getPublishedPdf } from '@/lib/resumes';
import { fail, handleError } from '@/lib/http';

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const pdf = await getPublishedPdf(slug);
    if (!pdf) return fail('Not found', 404);
    return new Response(pdf as BodyInit, {
      headers: { 'content-type': 'application/pdf', 'content-disposition': 'inline; filename="resume.pdf"', 'cache-control': 'public, max-age=60' },
    });
  } catch (e) {
    return handleError(e);
  }
}
