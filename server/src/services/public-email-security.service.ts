import 'dotenv/config';
import crypto from 'node:crypto';
import NodeCache from 'node-cache';
import { z } from 'zod';
import { AppError } from '../utils/app-error.js';

const config = z.object({
    RECAPTCHA_SECRET_KEY: z.string().optional(),
    RECAPTCHA_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.5),
    RECAPTCHA_HOSTNAME: z.string().optional(),
}).parse(process.env);
const limits = new NodeCache({ stdTTL: 60, checkperiod: 60, useClones: false });
export class EmailRateLimitError extends AppError {
    constructor(public readonly retryAfterSeconds: number) {
        super(429, 'Vui lòng chờ trước khi gửi lại yêu cầu.', 'RATE_LIMITED');
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export function enforceEmailRateLimit(scope: string, email: string, ip: string) {
    const keys = [`${scope}:ip:${ip}`, `${scope}:email:${crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}`];
    const retry = Math.max(...keys.map(key => Math.ceil(((limits.getTtl(key) || 0) - Date.now()) / 1000)));
    if (retry > 0) throw new EmailRateLimitError(retry);
    // No await between checking and reserving both keys.
    keys.forEach(key => limits.set(key, true));
}

export async function verifyRecaptcha(token: string, action: string, ip: string) {
    try {
        if (!config.RECAPTCHA_SECRET_KEY) throw new Error('Unconfigured');
        const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST', signal: AbortSignal.timeout(8000),
            body: new URLSearchParams({ secret: config.RECAPTCHA_SECRET_KEY, response: token, remoteip: ip }),
        });
        const data = await response.json() as { success?: boolean; score?: number; action?: string; hostname?: string };
        if (!response.ok || data.success !== true || data.action !== action || typeof data.score !== 'number'
            || !Number.isFinite(data.score) || data.score < config.RECAPTCHA_MIN_SCORE
            || (config.RECAPTCHA_HOSTNAME && data.hostname !== config.RECAPTCHA_HOSTNAME)) throw new Error('Rejected');
    } catch {
        throw AppError.badRequest('Không thể xử lý yêu cầu. Vui lòng thử lại.', 'REQUEST_REJECTED');
    }
}
