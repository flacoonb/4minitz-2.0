let _jwtSecret: string | undefined;
let _encryptionSecret: string | undefined;

export function getJwtSecret(): string {
  if (!_jwtSecret) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error(
        'JWT_SECRET environment variable is not set. ' +
        'Please define it in your .env.local file.'
      );
    }
    _jwtSecret = secret;
  }
  return _jwtSecret;
}

export function getEncryptionSecret(): string {
  if (!_encryptionSecret) {
    const secret = process.env.ENCRYPTION_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
      throw new Error(
        'ENCRYPTION_SECRET environment variable is not set. ' +
        'Please define it in your .env.local file.'
      );
    }
    _encryptionSecret = secret;
  }
  return _encryptionSecret;
}
