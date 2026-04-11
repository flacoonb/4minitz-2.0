import { describe, it, expect } from 'vitest';
import { isValidEmailAddress, isHexObjectIdLike } from '@/lib/input-validation';

describe('isValidEmailAddress', () => {
  const valid = [
    'simple@example.com',
    'very.common@example.org',
    'user+tag@sub.example.co.uk',
    'x@y.zz',
    'user@123.123.123.com',
  ];
  for (const email of valid) {
    it(`accepts "${email}"`, () => {
      expect(isValidEmailAddress(email)).toBe(true);
    });
  }

  const invalid = [
    '',
    'plaintext',
    '@no-local.com',
    'no-at-sign',
    'user@',
    'user@.com',
    'user@com.',
    'user@@double.com',
    'user@-start.com',
    'user@end-.com',
    '  spaces @example.com',
    'a'.repeat(65) + '@example.com',
    'user@' + 'x'.repeat(254) + '.com',
    'user\n@example.com',
    'user\t@example.com',
  ];
  for (const email of invalid) {
    it(`rejects "${email.slice(0, 40)}${email.length > 40 ? '...' : ''}"`, () => {
      expect(isValidEmailAddress(email)).toBe(false);
    });
  }
});

describe('isHexObjectIdLike', () => {
  it('accepts valid 24-char hex', () => {
    expect(isHexObjectIdLike('507f1f77bcf86cd799439011')).toBe(true);
  });

  it('accepts uppercase hex', () => {
    expect(isHexObjectIdLike('507F1F77BCF86CD799439011')).toBe(true);
  });

  it('rejects too short', () => {
    expect(isHexObjectIdLike('507f1f77bcf86cd79943901')).toBe(false);
  });

  it('rejects too long', () => {
    expect(isHexObjectIdLike('507f1f77bcf86cd7994390111')).toBe(false);
  });

  it('rejects non-hex chars', () => {
    expect(isHexObjectIdLike('507f1f77bcf86cd79943901g')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isHexObjectIdLike('')).toBe(false);
  });
});
