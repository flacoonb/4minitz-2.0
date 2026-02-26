import crypto from 'crypto';
import { getEncryptionSecret } from '@/lib/validateEnv';

const ALGORITHM = 'aes-256-cbc';

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
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
    if (!text) return text;
    try {
        const textParts = text.split(':');
        if (textParts.length !== 2) {
            throw new Error('Invalid encrypted format');
        }

        const key = getKey();
        const iv = Buffer.from(textParts[0], 'hex');
        const encryptedText = Buffer.from(textParts[1], 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch {
        throw new Error('Decryption failed');
    }
}
