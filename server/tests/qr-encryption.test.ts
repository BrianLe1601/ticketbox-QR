import { beforeEach, expect, it, vi } from 'vitest';
const config = vi.hoisted(() => ({ QR_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), QR_ENCRYPTION_KEY_ID: 'test-v1' }));
vi.mock('../src/config/env.js', () => ({ env: config }));
import { decryptQrToken, encryptQrToken } from '../src/services/qr-encryption.service.js';

beforeEach(() => { config.QR_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64'); config.QR_ENCRYPTION_KEY_ID = 'test-v1'; });
const token = 'a'.repeat(64);
it('round trips the original token with unique 12-byte nonces and fits the DB column', () => {
    const first = encryptQrToken(token, 'T1'); const second = encryptQrToken(token, 'T1');
    expect(first).not.toBe(second); expect(first.length).toBeLessThanOrEqual(512);
    expect(decryptQrToken(first, 'T1')).toBe(token); expect(decryptQrToken(second, 'T1')).toBe(token);
    const payload = JSON.parse(Buffer.from(first, 'base64').toString());
    expect(Buffer.from(payload[2], 'base64')).toHaveLength(12); expect(Buffer.from(payload[4], 'base64')).toHaveLength(16);
});
it('rejects another ticket, wrong key, changed ciphertext/tag and unknown key IDs', () => {
    const envelope = encryptQrToken(token, 'T1');
    expect(() => decryptQrToken(envelope, 'T2')).toThrow(expect.objectContaining({ code: 'QR_DECRYPT_FAILED' }));
    for (const index of [3, 4]) {
        const payload = JSON.parse(Buffer.from(envelope, 'base64').toString());
        const bytes = Buffer.from(payload[index], 'base64'); bytes[0] = bytes[0]! ^ 1; payload[index] = bytes.toString('base64');
        expect(() => decryptQrToken(Buffer.from(JSON.stringify(payload)).toString('base64'), 'T1')).toThrow(expect.objectContaining({ code: 'QR_DECRYPT_FAILED' }));
    }
    config.QR_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString('base64');
    expect(() => decryptQrToken(envelope, 'T1')).toThrow(expect.objectContaining({ code: 'QR_DECRYPT_FAILED' }));
    config.QR_ENCRYPTION_KEY_ID = 'other';
    expect(() => decryptQrToken(envelope, 'T1')).toThrow(expect.objectContaining({ code: 'QR_KEY_UNAVAILABLE' }));
});
it('rejects malformed envelopes and missing keys without exposing input', () => {
    for (const value of ['', 'not base64', Buffer.from('["v2"]').toString('base64')]) {
        expect(() => decryptQrToken(value, 'T1')).toThrow(expect.objectContaining({ code: 'QR_PAYLOAD_INVALID' }));
    }
    config.QR_ENCRYPTION_KEY = '';
    expect(() => encryptQrToken(token, 'T1')).toThrow(expect.objectContaining({ code: 'QR_KEY_UNAVAILABLE' }));
});
