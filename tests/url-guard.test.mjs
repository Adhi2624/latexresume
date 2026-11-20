// Unit tests for the SSRF guard (transpiled on the fly; no app needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const src = readFileSync(new URL('../lib/url-guard.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { assertSafeBaseUrl, AiBadUrl } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

function inProd(fn) {
  const old = { ...process.env };
  process.env.NODE_ENV = 'production';
  delete process.env.ALLOW_PRIVATE_AI_URLS;
  delete process.env.ALLOW_CUSTOM_AI_URLS;
  try { return fn(); } finally { process.env = old; }
}
const blocked = (u) => inProd(() => assert.throws(() => assertSafeBaseUrl(u), AiBadUrl, `should block ${u}`));
const allowed = (u) => inProd(() => assert.doesNotThrow(() => assertSafeBaseUrl(u), `should allow ${u}`));

test('blocks loopback, private, link-local and metadata targets in production', () => {
  for (const u of [
    'http://localhost:11434', 'http://localhost./v1', 'http://api.localhost/v1', 'http://127.0.0.1', 'http://127.1', 'http://0x7f.0.0.1',
    'http://2130706433', 'http://10.0.0.5', 'http://172.16.0.1', 'http://172.31.255.255', 'http://192.168.1.1', 'http://169.254.169.254/latest/meta-data',
    'http://100.64.0.1', 'http://0.0.0.0', 'http://[::1]', 'http://[::]', 'http://[fe80::1]', 'http://[fd00::1]', 'http://[fc00::1]',
    'http://[::ffff:127.0.0.1]', 'http://[::ffff:169.254.169.254]', 'http://[::ffff:10.0.0.1]',
    'http://metadata.google.internal.', 'http://service.internal', 'http://printer.local',
  ]) blocked(u);
});

test('allows public hosts, including names that merely start with fc/fd', () => {
  for (const u of ['https://api.openai.com/v1', 'https://openrouter.ai/api/v1', 'https://fcdn.example.com', 'https://fd-api.example.org', 'http://93.184.216.34', 'http://[2606:4700::1111]']) allowed(u);
});

test('rejects non-http schemes everywhere and honours the overrides', () => {
  assert.throws(() => assertSafeBaseUrl('file:///etc/passwd'), AiBadUrl);
  assert.throws(() => assertSafeBaseUrl('ftp://example.com'), AiBadUrl);
  // development: private targets (Ollama on localhost) are fine
  const old = { ...process.env };
  try {
    process.env.NODE_ENV = 'development';
    assert.doesNotThrow(() => assertSafeBaseUrl('http://localhost:11434/v1'));
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_PRIVATE_AI_URLS = 'true';
    assert.doesNotThrow(() => assertSafeBaseUrl('http://localhost:11434/v1'));
    process.env.ALLOW_CUSTOM_AI_URLS = 'false';
    delete process.env.ALLOW_PRIVATE_AI_URLS;
    assert.throws(() => assertSafeBaseUrl('https://api.openai.com/v1'), AiBadUrl);
  } finally { process.env = old; }
});
