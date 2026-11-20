import { TEMPLATES } from '@/lib/templates';
import { ok } from '@/lib/http';

export async function GET() {
  return ok(TEMPLATES.map(({ latexSource: _s, ...t }) => t));
}
