export const CLUB_FUNCTION_PREFIX = 'function:';

export function parseFunctionToken(value: string): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith(CLUB_FUNCTION_PREFIX)) return null;
  const slug = value.slice(CLUB_FUNCTION_PREFIX.length).trim().toLowerCase();
  return slug || null;
}

export function createFunctionToken(slug: string): string {
  return `${CLUB_FUNCTION_PREFIX}${slug}`;
}

export function humanizeFunctionToken(value: string): string {
  const slug = parseFunctionToken(value);
  if (!slug) return value;
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
