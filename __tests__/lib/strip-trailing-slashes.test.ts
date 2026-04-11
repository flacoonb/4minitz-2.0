import { describe, it, expect } from 'vitest';
import { stripTrailingSlashes } from '@/lib/strip-trailing-slashes';

describe('stripTrailingSlashes', () => {
  it('removes single trailing slash', () => {
    expect(stripTrailingSlashes('https://example.com/')).toBe('https://example.com');
  });

  it('removes multiple trailing slashes', () => {
    expect(stripTrailingSlashes('https://example.com///')).toBe('https://example.com');
  });

  it('leaves string without trailing slash unchanged', () => {
    expect(stripTrailingSlashes('https://example.com')).toBe('https://example.com');
  });

  it('handles empty string', () => {
    expect(stripTrailingSlashes('')).toBe('');
  });

  it('handles string of only slashes', () => {
    expect(stripTrailingSlashes('///')).toBe('');
  });

  it('preserves internal slashes', () => {
    expect(stripTrailingSlashes('https://example.com/path/to/')).toBe('https://example.com/path/to');
  });

  it('handles very long trailing slash string without hanging (ReDoS safe)', () => {
    const input = 'x' + '/'.repeat(100_000);
    const start = performance.now();
    const result = stripTrailingSlashes(input);
    const elapsed = performance.now() - start;
    expect(result).toBe('x');
    expect(elapsed).toBeLessThan(100);
  });
});
