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

/**
 * Validates common raster image signatures (magic bytes) to prevent
 * trusting only file extension or client-provided MIME type.
 */
export function isAllowedImageSignature(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 12) return false;

  // JPEG: FF D8 FF
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  // GIF: ASCII "GIF87a" or "GIF89a"
  const isGif =
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61;

  // WEBP: ASCII "RIFF" .... "WEBP"
  const isWebp =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  return isJpeg || isPng || isGif || isWebp;
}
