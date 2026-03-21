/**
 * Minimal HS256 JWT verify for Edge (proxy / middleware) using Web Crypto.
 * Does not hit MongoDB — tokenVersion revocation is still enforced in server layouts/API.
 */

function base64UrlToBytes(str: string): Uint8Array | null {
  try {
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = s.length % 4;
    if (pad) s += '='.repeat(4 - pad);
    const binary = atob(s);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Returns true if token is well-formed HS256 JWT, signature valid, and not expired. */
export async function verifyJwtHs256Edge(token: string, secret: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [h, p, s] = parts;
  if (!h || !p || !s) return false;

  let payload: { exp?: number };
  try {
    const payloadBytes = base64UrlToBytes(p);
    if (!payloadBytes) return false;
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as { exp?: number };
  } catch {
    return false;
  }

  if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
    return false;
  }

  const data = new TextEncoder().encode(`${h}.${p}`);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, data);
  const expected = new Uint8Array(sigBuf);
  const claimed = base64UrlToBytes(s);
  if (!claimed) return false;
  return timingSafeEqual(expected, claimed);
}
