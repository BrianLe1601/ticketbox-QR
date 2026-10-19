import crypto from "node:crypto";

import { env } from "../../config/env.js";

/**
 * Stateless, single-use Admin password-reset tokens: `<userId>.<expiresAtSeconds>.<hmac>`.
 * The HMAC covers the account's current password hash, so the token stops working as soon as the
 * password changes (after a reset or a normal change) and needs no table. The key is derived from
 * JWT_SECRET with a dedicated label, so it can never be confused with an access token signature.
 * Tokens travel only in the email link fragment and in JSON bodies; never log them.
 */
export const RESET_TTL_MINUTES = 30;
const TOKEN_PATTERN = /^([1-9]\d{0,18})\.(\d{10})\.([A-Za-z0-9_-]{43})$/;

let cachedKey: Buffer | null = null;
function resetKey(): Buffer {
  cachedKey ??= Buffer.from(crypto.hkdfSync("sha256", env.JWT_SECRET, "ticketbox", "admin-password-reset:v1", 32));
  return cachedKey;
}

function signature(userId: number, expiresAt: number, passwordHash: string): string {
  return crypto.createHmac("sha256", resetKey()).update(`v1|${userId}|${expiresAt}|${passwordHash}`).digest("base64url");
}

export function createResetToken(userId: number, passwordHash: string, now = new Date()) {
  const expiresAt = Math.floor(now.getTime() / 1000) + RESET_TTL_MINUTES * 60;
  return { token: `${userId}.${expiresAt}.${signature(userId, expiresAt, passwordHash)}`, expiresAt: new Date(expiresAt * 1000) };
}

export interface ParsedResetToken { userId: number; expiresAt: number; signature: string }

export function parseResetToken(value: string): ParsedResetToken | null {
  const match = TOKEN_PATTERN.exec(value);
  if (!match) return null;
  const userId = Number(match[1]);
  if (!Number.isSafeInteger(userId)) return null;
  return { userId, expiresAt: Number(match[2]), signature: match[3]! };
}

/** True only for an unexpired token signed for this exact password hash (constant-time compare). */
export function verifyResetToken(parsed: ParsedResetToken, passwordHash: string, now = new Date()): boolean {
  if (parsed.expiresAt * 1000 <= now.getTime()) return false;
  const expected = Buffer.from(signature(parsed.userId, parsed.expiresAt, passwordHash));
  const supplied = Buffer.from(parsed.signature);
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}
