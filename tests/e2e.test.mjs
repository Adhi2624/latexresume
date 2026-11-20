// End-to-end API test. Requires a running app (default http://localhost:3000),
// MongoDB and the LaTeX compiler:   pnpm dev & node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const email = `e2e-${Date.now()}@example.com`;
const password = 'Passw0rd!long';
let cookie = '';
let token = '';
let resumeId = '';
let slug = '';

async function call(path, { method = 'GET', body, auth = 'cookie', headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['content-type'] = 'application/json';
  if (auth === 'cookie' && cookie) h.cookie = cookie;
  if (auth === 'bearer') h.authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  return res;
}
const json = (r) => r.json();
const mcp = async (method, params, id = 1) =>
  json(await call('/mcp', { method: 'POST', auth: 'bearer', body: { jsonrpc: '2.0', id, method, params } }));

test('health', async () => {
  const r = await call('/api/health');
  assert.equal(r.status, 200);
  assert.equal((await json(r)).database, 'up');
});

test('rejects unauthenticated access', async () => {
  assert.equal((await call('/api/resumes', { auth: 'none' })).status, 401);
  assert.equal((await call('/mcp', { method: 'POST', auth: 'none', body: {} })).status, 401);
});

test('signup validation + success + duplicate', async () => {
  assert.equal((await call('/api/auth/signup', { method: 'POST', body: { email: 'bad', password, name: 'X' } })).status, 422);
  assert.equal((await call('/api/auth/signup', { method: 'POST', body: { email, password: 'weak', name: 'X' } })).status, 422);
  const r = await call('/api/auth/signup', { method: 'POST', body: { email: `a.b@example.technology`, password, name: 'Long TLD' } });
  assert.ok([201, 409].includes(r.status), 'long TLDs are accepted');
  const ok = await call('/api/auth/signup', { method: 'POST', body: { email, password, name: 'E2E User' } });
  assert.equal(ok.status, 201);
  cookie = ok.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  assert.match(cookie, /lr_session=/);
  assert.equal((await call('/api/auth/signup', { method: 'POST', body: { email, password, name: 'Dup' } })).status, 409);
});

test('login: wrong password rejected, right one accepted', async () => {
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { email, password: 'Wrong1234' }, auth: 'none' })).status, 401);
  const ok = await call('/api/auth/login', { method: 'POST', body: { email, password }, auth: 'none' });
  assert.equal(ok.status, 200);
  cookie = ok.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const s = await json(await call('/api/auth/session'));
  assert.equal(s.data.email, email);
});

test('every template compiles to a PDF', async () => {
  const templates = (await json(await call('/api/templates'))).data;
  assert.ok(templates.length >= 3);
  for (const t of templates) {
    const c = await json(await call('/api/resumes', { method: 'POST', body: { title: `T ${t.id}`, templateId: t.id } }));
    assert.equal(c.success, true);
    const r = await call(`/api/resumes/${c.data.id}/compile`, { method: 'POST', body: {} });
    assert.equal(r.status, 200, `${t.id} should compile`);
    const buf = Buffer.from(await r.arrayBuffer());
    assert.equal(buf.subarray(0, 4).toString(), '%PDF');
    if (t.id === 'classic') resumeId = c.data.id;
    else await call(`/api/resumes/${c.data.id}`, { method: 'DELETE' });
  }
});

test('resume CRUD, ownership and compile errors', async () => {
  const list = (await json(await call('/api/resumes'))).data;
  assert.ok(list.some((r) => r.id === resumeId));
  assert.equal((await call('/api/resumes/not-an-id')).status, 404);
  const put = await json(await call(`/api/resumes/${resumeId}`, { method: 'PUT', body: { title: 'Renamed' } }));
  assert.equal(put.data.title, 'Renamed');
  const bad = await call(`/api/resumes/${resumeId}/compile`, { method: 'POST', body: { latexSource: '\\documentclass{article}\\begin{document}\\undefinedcommand\\end{document}' } });
  assert.equal(bad.status, 422);
  assert.match((await json(bad)).error, /Undefined control sequence|failed/i);
  // A second user must not see the first user's resume.
  const other = await call('/api/auth/signup', { method: 'POST', auth: 'none', body: { email: `o-${Date.now()}@example.com`, password, name: 'Other' } });
  const otherCookie = other.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  assert.equal((await fetch(`${BASE}/api/resumes/${resumeId}`, { headers: { cookie: otherCookie } })).status, 404);
});

test('publish → public page + pdf → unpublish', async () => {
  const p = await json(await call(`/api/resumes/${resumeId}/publish`, { method: 'POST' }));
  slug = p.data.slug;
  assert.ok(slug);
  const page = await fetch(`${BASE}/r/${slug}`);
  assert.equal(page.status, 200);
  const pdf = await fetch(`${BASE}/api/public/${slug}/pdf`);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  await call(`/api/resumes/${resumeId}/publish`, { method: 'DELETE' });
  assert.equal((await fetch(`${BASE}/api/public/${slug}/pdf`)).status, 404);
  assert.equal((await fetch(`${BASE}/r/${slug}`)).status, 404);
});

test('settings: AI key is stored encrypted and never returned', async () => {
  const r = await json(await call('/api/settings', { method: 'PUT', body: { ai: { provider: 'anthropic', model: 'claude-sonnet-4-5', apiKey: 'sk-test-secret-123' } } }));
  assert.equal(r.data.ai.hasApiKey, true);
  assert.ok(!JSON.stringify(r).includes('sk-test-secret-123'));
  const chat = await call(`/api/resumes/${resumeId}/chat`, { method: 'POST', body: { message: 'hi' } });
  assert.ok([502, 200].includes(chat.status)); // fake key → upstream error, handled gracefully
  await call('/api/settings', { method: 'PUT', body: { ai: { provider: 'openai', model: '', clearKey: true } } });
  const none = await call(`/api/resumes/${resumeId}/chat`, { method: 'POST', body: { message: 'hi' } });
  assert.ok([400, 200].includes(none.status));
});

test('API tokens + MCP server', async () => {
  const t = await json(await call('/api/tokens', { method: 'POST', body: { name: 'e2e' } }));
  token = t.data.token;
  assert.match(token, /^lrp_/);
  const init = await mcp('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  assert.equal(init.result.serverInfo.name, 'latexresume');
  const tools = (await mcp('tools/list')).result.tools.map((x) => x.name);
  for (const n of ['list_resumes', 'get_resume', 'create_resume', 'update_resume', 'compile_resume', 'publish_resume']) assert.ok(tools.includes(n), n);
  const created = JSON.parse((await mcp('tools/call', { name: 'create_resume', arguments: { title: 'Via MCP', template_id: 'modern' } })).result.content[0].text);
  const compiled = await mcp('tools/call', { name: 'compile_resume', arguments: { id: created.id } });
  assert.ok(!compiled.result.isError, JSON.stringify(compiled));
  const pdf = await call(`/api/resumes/${created.id}/pdf`, { auth: 'bearer' });
  assert.equal(pdf.status, 200);
  const err = await mcp('tools/call', { name: 'get_resume', arguments: { id: 'ffffffffffffffffffffffff' } });
  assert.equal(err.result.isError, true);
  assert.equal((await mcp('nope/nope')).error.code, -32601);
  await mcp('tools/call', { name: 'delete_resume', arguments: { id: created.id } });
  // revoked tokens stop working
  const list = (await json(await call('/api/tokens'))).data;
  await call(`/api/tokens/${list[0].id}`, { method: 'DELETE' });
  assert.equal((await call('/mcp', { method: 'POST', auth: 'bearer', body: { jsonrpc: '2.0', id: 1, method: 'ping' } })).status, 401);
});

test('hardening: malformed JSON, per-field errors, AI URL scheme, MCP batches', async () => {
  // malformed JSON is a 400, not silently treated as {}
  const bad = await fetch(`${BASE}/api/resumes/${resumeId}`, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: '{bad' });
  assert.equal(bad.status, 400);
  // validation errors are reported per field
  const v = await call('/api/auth/signup', { method: 'POST', auth: 'none', body: { email: 'nope', password: 'x', name: '' } });
  assert.equal(v.status, 422);
  const vb = await json(v);
  assert.ok(vb.fields.email && vb.fields.password && vb.fields.name);
  // non-http base URLs are rejected
  const url = await call('/api/settings', { method: 'PUT', body: { ai: { provider: 'openai', model: '', baseURL: 'file:///etc/passwd' } } });
  assert.equal(url.status, 422);
  // MCP: malformed batch members yield per-item errors, oversized batches are rejected
  const t = await json(await call('/api/tokens', { method: 'POST', body: { name: 'hardening' } }));
  token = t.data.token;
  const batch = await call('/mcp', { method: 'POST', auth: 'bearer', body: [1, null, 'x', { jsonrpc: '2.0', id: 9, method: 'ping' }] });
  assert.equal(batch.status, 200);
  const items = await json(batch);
  assert.equal(items.filter((i) => i.error?.code === -32600).length, 3);
  const big = await call('/mcp', { method: 'POST', auth: 'bearer', body: Array.from({ length: 50 }, (_, i) => ({ jsonrpc: '2.0', id: i, method: 'ping' })) });
  assert.equal(big.status, 400);
});

test('non-object JSON bodies are rejected with 400, never 500', async () => {
  for (const body of ['null', '[]', '"s"', '1']) {
    const r = await fetch(`${BASE}/api/resumes/${resumeId}/compile`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body });
    assert.equal(r.status, 400, `body ${body}`);
  }
  const m = await call('/mcp', { method: 'POST', auth: 'bearer', body: null });
  assert.equal(m.status, 400);
  assert.equal((await json(m)).error.code, -32600);
});

test('rate-limit spoofing: rotating X-Forwarded-For does not reset the per-account login limit', async () => {
  if (process.env.RATE_LIMIT_SCALE !== '1') return; // limits are scaled x100 in dev; run with RATE_LIMIT_SCALE=1 to enable
  const target = `victim-${Date.now()}@example.com`;
  let limited = false;
  for (let i = 0; i < 40 && !limited; i++) {
    const r = await call('/api/auth/login', { method: 'POST', auth: 'none', body: { email: target, password: 'Wrong1234' }, headers: { 'x-forwarded-for': `9.9.9.${i}` } });
    limited = r.status === 429;
  }
  assert.ok(limited, 'expected 429 after repeated failures regardless of spoofed IP');
});

test('one compile at a time per user (no compiler monopolisation)', async () => {
  const loop = '\\documentclass{article}\\begin{document}\\def\\a{\\a}\\a\\end{document}';
  // Fire several compiles in parallel; at most one may be in flight, the rest must be refused quickly.
  const results = await Promise.all(Array.from({ length: 4 }, () => call(`/api/resumes/${resumeId}/compile`, { method: 'POST', body: { latexSource: loop } })));
  const statuses = results.map((r) => r.status).sort();
  assert.ok(statuses.filter((x) => x === 503).length >= 3, `expected >=3 refusals, got ${statuses}`);
});

test('logout revokes the session server-side', async () => {
  const stale = cookie;
  await call('/api/auth/logout', { method: 'POST' });
  assert.equal((await call('/api/resumes', { auth: 'none' })).status, 401);
  // replaying the old cookie must not work any more
  assert.equal((await fetch(`${BASE}/api/resumes`, { headers: { cookie: stale } })).status, 401);
});
