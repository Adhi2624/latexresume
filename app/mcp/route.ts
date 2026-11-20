import { getSession } from '@/lib/auth';
import { handleRpc } from '@/lib/mcp';
import { handleError } from '@/lib/http';

/**
 * Model Context Protocol server (Streamable HTTP, stateless, JSON responses).
 * Authenticate with `Authorization: Bearer lrp_…` (create a token in Settings).
 */
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id',
  'access-control-allow-methods': 'POST, OPTIONS',
};

export const OPTIONS = () => new Response(null, { status: 204, headers: cors });

export const GET = () =>
  new Response('This MCP endpoint accepts POST requests (Streamable HTTP).', { status: 405, headers: { ...cors, allow: 'POST' } });

export async function POST(req: Request) {
  try {
    const bearer = req.headers.get('authorization')?.startsWith('Bearer ');
    const session = bearer ? await getSession(req) : null;
    if (!session) {
      return Response.json(
        { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized: send a Bearer API token created in Settings' } },
        { status: 401, headers: { ...cors, 'www-authenticate': 'Bearer realm="latexresume"' } },
      );
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = undefined;
    }
    if (body === undefined) {
      return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400, headers: cors });
    }
    if (body === null) {
      return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } }, { status: 400, headers: cors });
    }
    if (Array.isArray(body)) {
      if (body.length === 0 || body.length > 20) {
        return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Batch must contain 1–20 requests' } }, { status: 400, headers: cors });
      }
      const out = (await Promise.all(body.map((m) => handleRpc(m, session.userId)))).filter(Boolean);
      return out.length ? Response.json(out, { headers: cors }) : new Response(null, { status: 202, headers: cors });
    }
    const out = await handleRpc(body as never, session.userId);
    return out ? Response.json(out, { headers: cors }) : new Response(null, { status: 202, headers: cors });
  } catch (e) {
    return handleError(e);
  }
}
