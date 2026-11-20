// Minimal LaTeX → PDF HTTP service. No dependencies.
//   POST /compile  {"source": "<tex>"}  →  200 application/pdf  |  422 {"error","log"}
//   GET  /health
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.PORT ?? 9000);
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? ''; // set this in production
const TIMEOUT_MS = Number(process.env.COMPILE_TIMEOUT_MS ?? 30_000);
const MAX_BODY = 600_000;
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT ?? 2);
let running = 0;

if (process.env.REQUIRE_AUTH === 'true' && !AUTH_TOKEN) {
  console.error('REQUIRE_AUTH=true but AUTH_TOKEN is not set; refusing to start an open compiler.');
  process.exit(1);
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'content-type': type });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Request too large'), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function runTex(dir) {
  return new Promise((resolve) => {
    // -no-shell-escape is the default; paranoid file access blocks reading/writing outside the job dir.
    const args = ['-interaction=nonstopmode', '-halt-on-error', '-no-shell-escape', 'resume.tex'];
    const env = { ...process.env, openin_any: 'p', openout_any: 'p', TEXMFOUTPUT: dir };
    const p = spawn('pdflatex', args, { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => { if (out.length < 200_000) out += d; });
    const timer = setTimeout(() => { p.kill('SIGKILL'); out += '\n[compile timed out]'; }, TIMEOUT_MS);
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, out }); });
    p.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, out: String(e) }); });
  });
}

function summarise(log) {
  const m = log.match(/^!.*$/m);
  return m ? m[0].slice(0, 300) : 'LaTeX compilation failed';
}

async function compile(source) {
  const dir = await mkdtemp(join(tmpdir(), 'tex-'));
  try {
    await writeFile(join(dir, 'resume.tex'), source, 'utf8');
    // Two passes so references / page counts settle.
    let r = await runTex(dir);
    if (r.code === 0) r = await runTex(dir);
    let pdf = null;
    if (r.code === 0) pdf = await readFile(join(dir, 'resume.pdf')).catch(() => null);
    return pdf ? { pdf } : { error: summarise(r.out), log: r.out.slice(-6000) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

http.createServer(async (req, res) => {
  // Render health checks / uptime pings hit /health without credentials.
  try {
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { status: 'ok' });
    if (req.method !== 'POST' || req.url !== '/compile') return send(res, 404, { error: 'Not found' });
    if (AUTH_TOKEN && req.headers.authorization !== `Bearer ${AUTH_TOKEN}`) return send(res, 401, { error: 'Unauthorized' });
    if (running >= MAX_CONCURRENT) return send(res, 429, { error: 'Compiler is busy, try again shortly' });
    let source;
    try { source = JSON.parse(await readBody(req)).source; } catch (e) {
      return send(res, e.status ?? 400, { error: e.status === 413 ? 'Request too large' : 'Invalid JSON body' });
    }
    if (typeof source !== 'string' || !source.trim()) return send(res, 400, { error: 'Missing "source"' });
    running++;
    try {
      const out = await compile(source);
      if (out.pdf) return send(res, 200, out.pdf, 'application/pdf');
      return send(res, 422, { error: out.error, log: out.log });
    } finally { running--; }
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Internal error' });
  }
}).listen(PORT, () => console.log(`latex compiler listening on :${PORT}`));
