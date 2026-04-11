import { describe, it, expect } from 'vitest';
import { verifyJwtHs256Edge } from '@/lib/verify-jwt-edge';
import crypto from 'crypto';

function base64UrlEncode(data: string): string {
  return Buffer.from(data, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function createTestJwt(payload: object, secret: string): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${data}.${sig}`;
}

const SECRET = 'test-jwt-secret-for-vitest-session';

describe('verifyJwtHs256Edge', () => {
  it('accepts a valid non-expired token', async () => {
    const token = createTestJwt(
      { userId: 'abc', exp: Math.floor(Date.now() / 1000) + 3600 },
      SECRET
    );
    expect(await verifyJwtHs256Edge(token, SECRET)).toBe(true);
  });

  it('accepts a token without exp (no expiry)', async () => {
    const token = createTestJwt({ userId: 'abc' }, SECRET);
    expect(await verifyJwtHs256Edge(token, SECRET)).toBe(true);
  });

  it('rejects an expired token', async () => {
    const token = createTestJwt(
      { userId: 'abc', exp: Math.floor(Date.now() / 1000) - 60 },
      SECRET
    );
    expect(await verifyJwtHs256Edge(token, SECRET)).toBe(false);
  });

  it('rejects token signed with wrong secret', async () => {
    const token = createTestJwt({ userId: 'abc' }, 'wrong-secret');
    expect(await verifyJwtHs256Edge(token, SECRET)).toBe(false);
  });

  it('rejects malformed token (too few parts)', async () => {
    expect(await verifyJwtHs256Edge('header.payload', SECRET)).toBe(false);
  });

  it('rejects empty string', async () => {
    expect(await verifyJwtHs256Edge('', SECRET)).toBe(false);
  });

  it('rejects tampered payload', async () => {
    const token = createTestJwt({ userId: 'abc', role: 'user' }, SECRET);
    const parts = token.split('.');
    parts[1] = base64UrlEncode(JSON.stringify({ userId: 'abc', role: 'admin' }));
    expect(await verifyJwtHs256Edge(parts.join('.'), SECRET)).toBe(false);
  });
});
