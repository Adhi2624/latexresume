export type CompileResult =
  | { ok: true; pdf: Uint8Array }
  | { ok: false; error: string; log?: string; busy?: boolean };

const MAX_SOURCE_BYTES = 500_000;

/**
 * Compiles LaTeX through the external compiler service (see /compiler).
 * Workers cannot run TeX, so the service is a separate container/host.
 */
export async function compileLatex(source: string): Promise<CompileResult> {
  const base = process.env.LATEX_COMPILER_URL;
  if (!base) {
    return { ok: false, error: 'LATEX_COMPILER_URL is not configured. See the README.' };
  }
  if (new TextEncoder().encode(source).length > MAX_SOURCE_BYTES) {
    return { ok: false, error: 'LaTeX source is too large (500 KB max).' };
  }
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (process.env.LATEX_COMPILER_TOKEN) {
    headers.authorization = `Bearer ${process.env.LATEX_COMPILER_TOKEN}`;
  }
  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, '')}/compile`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ source }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return { ok: false, error: 'Could not reach the LaTeX compiler service.', busy: true };
  }
  if (res.ok && res.headers.get('content-type')?.includes('application/pdf')) {
    return { ok: true, pdf: new Uint8Array(await res.arrayBuffer()) };
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string; log?: string };
  if (res.status === 429 || res.status === 503) return { ok: false, error: 'The compiler is busy. Please try again in a few seconds.', busy: true };
  return { ok: false, error: body.error ?? `Compiler returned HTTP ${res.status}`, log: body.log };
}
