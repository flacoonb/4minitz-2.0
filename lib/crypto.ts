import crypto from 'crypto';
import { getEncryptionSecret } from '@/lib/validateEnv';

const ALGORITHM = 'aes-256-gcm';
const LEGACY_ALGORITHM = 'aes-256-cbc';
const CURRENT_VERSION = 'v2';

let _key: Buffer | null = null;

function getKey(): Buffer {
    if (!_key) {
        const secret = getEncryptionSecret();
        _key = crypto.createHash('sha256').update(secret).digest().subarray(0, 32);
    }
    return _key;
}

export function encrypt(text: string): string {
    if (!text) return text;
    const key = getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${CURRENT_VERSION}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(text: string): string {
    if (!text) return text;
    try {
        const key = getKey();
        const parts = text.split(':');

        // Current format: v2:<ivHex>:<authTagHex>:<cipherHex>
        if (parts.length === 4 && parts[0] === CURRENT_VERSION) {
            const iv = Buffer.from(parts[1], 'hex');
            const authTag = Buffer.from(parts[2], 'hex');
            const encryptedText = Buffer.from(parts[3], 'hex');
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString('utf8');
        }

        // Legacy format (backward compatibility): <ivHex>:<cipherHex>
        if (parts.length !== 2) {
            throw new Error('Invalid encrypted format');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');
        const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf8');
    } catch {
        throw new Error('Decryption failed');
    }
}
