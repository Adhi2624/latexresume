/** WebCrypto helpers (work on Node 20+ and Cloudflare Workers). */

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// Workers cap PBKDF2 at 100,000 iterations.
const PBKDF2_ITERATIONS = 100_000;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2') return false;
  const derived = b64(await pbkdf2(password, unb64(salt), Number(iter)));
  return timingSafeEqual(derived, hash);
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 32): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Rejects missing, short or still-placeholder secrets (placeholders are tolerated only outside production). */
export function requireSecret(name: 'JWT_SECRET' | 'ENCRYPTION_SECRET'): string {
  const v = process.env[name];
  if (!v || v.length < 16) throw new Error(`${name} must be set (at least 16 characters)`);
  if (process.env.NODE_ENV === 'production' && /^change-me/i.test(v)) {
    throw new Error(`${name} is still the placeholder from .env.example — generate a real one (openssl rand -base64 48)`);
  }
  return v;
}

async function aesKey(): Promise<CryptoKey> {
  const secret = requireSecret('ENCRYPTION_SECRET');
  const material = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(), enc.encode(plain));
  return `${b64(iv)}.${b64(ct)}`;
}

export async function decryptSecret(payload: string): Promise<string> {
  const [iv, ct] = payload.split('.');
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(iv) as BufferSource },
    await aesKey(),
    unb64(ct) as BufferSource,
  );
  return dec.decode(pt);
}
