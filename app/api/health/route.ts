import { withDb } from '@/lib/db';

export async function GET() {
  try {
    await withDb((db) => db.command({ ping: 1 }));
    return Response.json({ status: 'ok', database: 'up', compiler: Boolean(process.env.LATEX_COMPILER_URL) });
  } catch {
    return Response.json({ status: 'degraded', database: 'down' }, { status: 503 });
  }
}
