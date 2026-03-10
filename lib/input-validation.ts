export function isValidEmailAddress(input: string): boolean {
  const value = input.trim();
  if (!value || value.length > 254) return false;
  if (value.includes(' ') || value.includes('\n') || value.includes('\r') || value.includes('\t')) return false;

  const atIndex = value.indexOf('@');
  if (atIndex <= 0) return false;
  if (atIndex !== value.lastIndexOf('@')) return false;
  if (atIndex === value.length - 1) return false;

  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);
  if (!local || !domain) return false;
  if (local.length > 64) return false;
  if (domain.length > 253) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false;

  const localAllowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.!#$%&'*+/=?^_`{|}~-";
  for (const ch of local) {
    if (!localAllowed.includes(ch)) return false;
  }

  const labels = domain.split('.');
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
    for (const ch of label) {
      const isAlphaNum =
        (ch >= 'a' && ch <= 'z') ||
        (ch >= 'A' && ch <= 'Z') ||
        (ch >= '0' && ch <= '9');
      if (!isAlphaNum && ch !== '-') return false;
    }
  }

  return true;
}

export function isHexObjectIdLike(input: string): boolean {
  if (input.length !== 24) return false;
  for (const ch of input) {
    const isHexLower = ch >= 'a' && ch <= 'f';
    const isHexUpper = ch >= 'A' && ch <= 'F';
    const isDigit = ch >= '0' && ch <= '9';
    if (!isHexLower && !isHexUpper && !isDigit) return false;
  }
  return true;
}
