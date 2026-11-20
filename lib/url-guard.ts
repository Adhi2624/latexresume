/** SSRF guard for user-supplied AI base URLs. Pure module (no imports) so it is easy to unit test. */

/** Returns true for loopback, private, link-local, CGNAT and other non-public IP literals / local names. */
function isNonPublicHost(rawHost: string): boolean {
  const h = rawHost.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, ''); // strip IPv6 brackets + trailing dots
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h === 'metadata') return true;

  // IPv4 literal (URL parsing already normalises 127.1, 0x7f.0.0.1 and decimal forms to dotted quad).
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) return isPrivateV4(v4.slice(1).map(Number) as [number, number, number, number]);

  // IPv6 literal (contains ':').
  if (h.includes(':')) {
    if (h === '::' || h === '::1') return true;
    // IPv4-mapped (::ffff:7f00:1 or ::ffff:127.0.0.1) → check the embedded IPv4.
    const mapped = h.match(/^(?:0{0,4}:){0,5}ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/) ?? null;
    if (mapped) {
      const hi = parseInt(mapped[1], 16), lo = parseInt(mapped[2], 16);
      return isPrivateV4([hi >> 8, hi & 255, lo >> 8, lo & 255]);
    }
    const dotted = h.match(/ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (dotted) return isPrivateV4(dotted.slice(1).map(Number) as [number, number, number, number]);
    // ULA fc00::/7, link-local fe80::/10, site-local fec0::/10, discard 100::/64, documentation 2001:db8::/32.
    return /^(f[cd][0-9a-f]{2}|fe[89abc][0-9a-f]|0100|2001:0?db8)/.test(h);
  }
  return false; // ordinary DNS name (cannot be resolved here — see docs/DEPLOY-CLOUDFLARE.md)
}

function isPrivateV4([a, b]: [number, number, number, number]): boolean {
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/**
 * Blocks loopback / private / link-local targets for user-supplied base URLs on production deployments (SSRF).
 * Local setups (Ollama on localhost) work in development, or when ALLOW_PRIVATE_AI_URLS=true.
 * Limitation: a public DNS name that *resolves* to a private address is not detected here. On Cloudflare
 * Workers the `global_fetch_strictly_public` flag (set in wrangler.jsonc) blocks such fetches at the platform level;
 * on self-hosted Node, put the server behind an egress firewall or set ALLOW_CUSTOM_AI_URLS=false.
 */
export function assertSafeBaseUrl(raw: string | undefined) {
  if (!raw) return;
  const u = new URL(raw);
  if (!/^https?:$/.test(u.protocol)) throw new AiBadUrl('Base URL must use http or https.');
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.ALLOW_CUSTOM_AI_URLS === 'false') throw new AiBadUrl('Custom AI base URLs are disabled on this server.');
  if (process.env.ALLOW_PRIVATE_AI_URLS === 'true') return;
  if (isNonPublicHost(u.hostname)) throw new AiBadUrl('Private or loopback base URLs are not allowed on this server.');
}

export class AiBadUrl extends Error {}
