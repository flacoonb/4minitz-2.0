import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('encrypt / decrypt', () => {
  const TEST_SECRET = 'test-encryption-secret-for-vitest-min32chars!!';

  beforeEach(() => {
    vi.stubEnv('ENCRYPTION_SECRET', TEST_SECRET);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('round-trips a string through encrypt then decrypt', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto');
    const plaintext = 'smtp-password-secret';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.startsWith('v2:')).toBe(true);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertext each time (random IV)', async () => {
    const { encrypt } = await import('@/lib/crypto');
    const a = encrypt('same-input');
    const b = encrypt('same-input');
    expect(a).not.toBe(b);
  });

  it('returns empty string for empty input', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto');
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });

  it('throws on tampered ciphertext', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto');
    const encrypted = encrypt('secret');
    const parts = encrypted.split(':');
    parts[3] = 'deadbeef' + parts[3].slice(8);
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  it('throws on invalid format', async () => {
    const { decrypt } = await import('@/lib/crypto');
    expect(() => decrypt('not:valid:at:all:five')).toThrow();
  });
});
