/**
 * Strip trailing slashes from a string in O(n) without regex.
 * Safe for user-controlled input (no ReDoS risk).
 */
export function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47 /* '/' */) {
    end--;
  }
  return end === value.length ? value : value.slice(0, end);
}
