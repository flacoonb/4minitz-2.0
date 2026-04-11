import { describe, it, expect } from 'vitest';
import { safePath, isAllowedImageSignature } from '@/lib/file-security';

describe('safePath', () => {
  it('allows simple filename', () => {
    const result = safePath('/base/uploads', 'photo.png');
    expect(result).toBe('/base/uploads/photo.png');
  });

  it('allows nested path', () => {
    const result = safePath('/base/uploads', 'sub/photo.png');
    expect(result).toBe('/base/uploads/sub/photo.png');
  });

  it('blocks path traversal with ../', () => {
    const result = safePath('/base/uploads', '../etc/passwd');
    expect(result).toBeNull();
  });

  it('blocks double traversal', () => {
    const result = safePath('/base/uploads', '../../secret');
    expect(result).toBeNull();
  });

  it('blocks encoded traversal through resolved path', () => {
    const result = safePath('/base/uploads', 'sub/../../outside');
    expect(result).toBeNull();
  });

  it('allows exact base directory match', () => {
    const result = safePath('/base/uploads', '.');
    expect(result).toBe('/base/uploads');
  });
});

describe('isAllowedImageSignature', () => {
  it('detects JPEG', () => {
    const buf = Buffer.alloc(16);
    buf[0] = 0xff; buf[1] = 0xd8; buf[2] = 0xff;
    expect(isAllowedImageSignature(buf)).toBe(true);
  });

  it('detects PNG', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(isAllowedImageSignature(buf)).toBe(true);
  });

  it('detects GIF89a', () => {
    const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
    expect(isAllowedImageSignature(buf)).toBe(true);
  });

  it('detects WEBP', () => {
    const buf = Buffer.alloc(16);
    buf.write('RIFF', 0);
    buf.write('WEBP', 8);
    expect(isAllowedImageSignature(buf)).toBe(true);
  });

  it('rejects arbitrary data', () => {
    const buf = Buffer.from('Hello, World!');
    expect(isAllowedImageSignature(buf)).toBe(false);
  });

  it('rejects too-short buffer', () => {
    expect(isAllowedImageSignature(Buffer.alloc(4))).toBe(false);
  });

  it('rejects null-like', () => {
    expect(isAllowedImageSignature(null as any)).toBe(false);
  });
});
