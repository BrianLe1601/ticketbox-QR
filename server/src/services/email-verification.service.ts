import crypto from 'node:crypto';
import { AppError } from '../utils/app-error.js';
import { sendEmailVerificationCode } from './mail.service.js';

interface PendingVerification { codeHash: string; expiresAt: number; lastSentAt: number; attempts: number }
interface VerifiedEmail { email: string; expiresAt: number }

const pending = new Map<string, PendingVerification>();
const verified = new Map<string, VerifiedEmail>();
const CODE_TTL_MS = 5 * 60_000;
const TOKEN_TTL_MS = 15 * 60_000;

function normalize(email: string) { return email.trim().toLowerCase(); }
function hash(value: string) { return crypto.createHash('sha256').update(value).digest('hex'); }

export async function requestEmailVerification(emailInput: string) {
    const email = normalize(emailInput);
    const current = pending.get(email);
    if (current && Date.now() - current.lastSentAt < 60_000) {
        throw AppError.badRequest('Vui lòng chờ 60 giây trước khi gửi lại mã', 'EMAIL_CODE_RATE_LIMIT');
    }
    const code = String(crypto.randomInt(100000, 1000000));
    await sendEmailVerificationCode(email, code);
    pending.set(email, { codeHash: hash(code), expiresAt: Date.now() + CODE_TTL_MS, lastSentAt: Date.now(), attempts: 0 });
    return { message: 'Mã xác minh đã được gửi', expiresInSeconds: CODE_TTL_MS / 1000 };
}

export function confirmEmailVerification(emailInput: string, code: string) {
    const email = normalize(emailInput);
    const record = pending.get(email);
    if (!record || record.expiresAt <= Date.now()) {
        pending.delete(email);
        throw AppError.badRequest('Mã xác minh đã hết hạn hoặc không tồn tại', 'EMAIL_CODE_EXPIRED');
    }
    record.attempts += 1;
    if (record.attempts > 5) {
        pending.delete(email);
        throw AppError.badRequest('Bạn đã nhập sai quá nhiều lần, vui lòng gửi mã mới', 'EMAIL_CODE_ATTEMPTS_EXCEEDED');
    }
    if (hash(code) !== record.codeHash) throw AppError.badRequest('Mã xác minh không đúng', 'INVALID_EMAIL_CODE');
    pending.delete(email);
    const token = crypto.randomBytes(32).toString('hex');
    verified.set(hash(token), { email, expiresAt: Date.now() + TOKEN_TTL_MS });
    return { verificationToken: token, email };
}

export function assertEmailVerified(emailInput: string, token: string) {
    const record = verified.get(hash(token));
    if (!record || record.expiresAt <= Date.now() || record.email !== normalize(emailInput)) {
        throw AppError.badRequest('Gmail chưa được xác minh hoặc phiên xác minh đã hết hạn', 'EMAIL_NOT_VERIFIED');
    }
}

export function consumeEmailVerification(token: string) { verified.delete(hash(token)); }
