import NodeCache from 'node-cache';
import { enforceEmailRateLimit, verifyRecaptcha } from './public-email-security.service.js';
import crypto from 'node:crypto';
import { AppError } from '../utils/app-error.js';
import { sendEmailVerificationCode } from './mail.service.js';

interface PendingVerification { codeHash: string; expiresAt: number; lastSentAt: number; attempts: number }
interface VerifiedEmail { email: string; expiresAt: number; session: string }

const pending = new NodeCache({ stdTTL: 300, checkperiod: 60, useClones: false });
const verified = new NodeCache({ stdTTL: 900, checkperiod: 60 });
const CODE_TTL_MS = 5 * 60_000;
const TOKEN_TTL_MS = 15 * 60_000;

function normalize(email: string) { return email.trim().toLowerCase(); }
function hash(value: string) { return crypto.createHash('sha256').update(value).digest('hex'); }

export async function requestEmailVerification(emailInput: string, token: string, ip: string, session: string) {
    const email = normalize(emailInput);
    await verifyRecaptcha(token, 'checkout_email', ip);
    enforceEmailRateLimit('checkout', email, ip);
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const cacheKey = hash(`${email}:${session}`);
    pending.set(cacheKey, { codeHash: hash(code), expiresAt: Date.now() + CODE_TTL_MS, lastSentAt: Date.now(), attempts: 0 });
    try { await sendEmailVerificationCode(email, code); }
    catch {
        pending.del(cacheKey);
        throw new AppError(503, 'Không thể gửi mã xác minh. Vui lòng thử lại sau.', 'EMAIL_SEND_FAILED');
    }
    return { message: 'Mã xác minh đã được gửi', expiresInSeconds: CODE_TTL_MS / 1000 };
}

export function confirmEmailVerification(emailInput: string, code: string, session: string) {
    const email = normalize(emailInput);
    const cacheKey = hash(`${email}:${session}`);
    const record = pending.get<PendingVerification>(cacheKey);
    if (!record || record.expiresAt <= Date.now()) {
        pending.del(cacheKey);
        throw AppError.badRequest('Mã xác minh đã hết hạn hoặc không tồn tại', 'EMAIL_CODE_EXPIRED');
    }
    record.attempts += 1;
    if (record.attempts > 5) {
        pending.del(cacheKey);
        throw AppError.badRequest('Bạn đã nhập sai quá nhiều lần, vui lòng gửi mã mới', 'EMAIL_CODE_ATTEMPTS_EXCEEDED');
    }
    if (hash(code) !== record.codeHash) { if (record.attempts >= 5) pending.del(cacheKey); throw AppError.badRequest('Mã xác minh không đúng', 'INVALID_EMAIL_CODE'); }
    pending.del(cacheKey);
    const token = crypto.randomBytes(32).toString('hex');
    verified.set(hash(token), { email, session, expiresAt: Date.now() + TOKEN_TTL_MS });
    return { verificationToken: token, email };
}

export function assertEmailVerified(emailInput: string, token: string, session = '') {
    const record = verified.get<VerifiedEmail>(hash(token));
    if (!record || !session || record.session !== session || record.expiresAt <= Date.now() || record.email !== normalize(emailInput)) {
        throw AppError.badRequest('Gmail chưa được xác minh hoặc phiên xác minh đã hết hạn', 'EMAIL_NOT_VERIFIED');
    }
}

export function consumeEmailVerification(token: string) { verified.del(hash(token)); }
