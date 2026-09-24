import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

function encryptionKey() {
    const key = Buffer.from(env.QR_ENCRYPTION_KEY ?? '', 'base64');
    if (key.length !== 32 || !env.QR_ENCRYPTION_KEY_ID) {
        throw new AppError(503, 'QR encryption key is unavailable', 'QR_KEY_UNAVAILABLE');
    }
    return key;
}

export function encryptQrToken(rawToken: string, ticketCode: string): string {
    if (!/^[a-f0-9]{64}$/.test(rawToken) || !ticketCode) {
        throw AppError.badRequest('Invalid QR payload', 'QR_PAYLOAD_INVALID');
    }
    const key = encryptionKey();
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
    cipher.setAAD(Buffer.from(ticketCode, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(rawToken, 'utf8'), cipher.final()]);
    const payload = ['v1', env.QR_ENCRYPTION_KEY_ID, nonce.toString('base64'), ciphertext.toString('base64'), cipher.getAuthTag().toString('base64')];
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export function decryptQrToken(envelope: string, ticketCode: string): string {
    const invalid = () => AppError.badRequest('Invalid encrypted QR payload', 'QR_PAYLOAD_INVALID');
    let parts: string[];
    try {
        if (!envelope || envelope.length > 512 || Buffer.from(envelope, 'base64').toString('base64') !== envelope) throw invalid();
        const parsed: unknown = JSON.parse(Buffer.from(envelope, 'base64').toString('utf8'));
        if (!Array.isArray(parsed) || parsed.length !== 5 || !parsed.every(item => typeof item === 'string') || parsed[0] !== 'v1') throw invalid();
        parts = parsed;
    } catch { throw invalid(); }
    const [, keyId, nonceText, ciphertextText, tagText] = parts;
    if (keyId !== env.QR_ENCRYPTION_KEY_ID) throw new AppError(503, 'QR encryption key is unavailable', 'QR_KEY_UNAVAILABLE');
    const key = encryptionKey();
    const nonce = Buffer.from(nonceText!, 'base64');
    const ciphertext = Buffer.from(ciphertextText!, 'base64');
    const tag = Buffer.from(tagText!, 'base64');
    if (nonce.length !== 12 || tag.length !== 16 || ciphertext.length !== 64 || !ticketCode
        || nonce.toString('base64') !== nonceText || ciphertext.toString('base64') !== ciphertextText || tag.toString('base64') !== tagText) throw invalid();
    try {
        const decipher = createDecipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
        decipher.setAAD(Buffer.from(ticketCode, 'utf8'));
        decipher.setAuthTag(tag);
        const rawToken = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
        if (!/^[a-f0-9]{64}$/.test(rawToken)) throw invalid();
        return rawToken;
    } catch { throw new AppError(500, 'Unable to decrypt QR credential', 'QR_DECRYPT_FAILED'); }
}
