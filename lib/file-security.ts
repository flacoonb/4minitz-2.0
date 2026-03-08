import path from 'path';

/**
 * Resolves a user-supplied path against a base directory and ensures
 * the result stays within that base directory (path traversal protection).
 *
 * Returns the resolved absolute path, or null if the path escapes the base directory.
 */
export function safePath(baseDir: string, userPath: string): string | null {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(baseDir, userPath);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    return null;
  }
  return resolved;
}
