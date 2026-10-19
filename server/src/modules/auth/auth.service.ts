import bcrypt from "bcrypt";
import crypto from "node:crypto";

import { env } from "../../config/env.js";
import { sendPasswordResetEmail } from "../../services/mail.service.js";
import { EmailRateLimitError, enforceEmailRateLimit } from "../../services/public-email-security.service.js";
import { AppError } from "../../utils/app-error.js";
import { signAccessToken } from "../../utils/jwt.js";
import {
  findActiveUserById,
  findGoogleStaffBySub,
  findUserByEmail,
  registerPendingGoogleStaff,
  lockActiveAdmin,
  replacePasswordAndRevokeSessions,
  transaction,
  updateAdminFullName,
} from "./auth.repository.js";
import type { AuthUserRow } from "./auth.repository.js";
import { verifyGoogleIdentity } from "./google-identity.service.js";
import type { LoginInput } from "./auth.schema.js";
import type { ChangeAdminPasswordInput, PasswordResetConfirmInput, PasswordResetRequestInput, UpdateAdminProfileInput } from "./auth.schema.js";
import { RESET_TTL_MINUTES, createResetToken, parseResetToken, verifyResetToken } from "./password-reset-token.js";
import { createSession, lockSession, pool, replaceSession, revokeSession } from "./auth-session.repository.js";
import { hashToken, newRefreshToken, parseRefreshToken, refreshExpiry } from "./refresh-token.js";

type SessionMetadata={userAgent:string|null;ip:string|null};

async function issueSession(user: AuthUserRow, metadata: SessionMetadata) {
  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  const refreshToken = newRefreshToken();
  await createSession(refreshToken.id, user.id, refreshToken.hash,
    refreshExpiry(), metadata.userAgent, metadata.ip);
  return {
    accessToken,
    refreshToken: refreshToken.value,
    user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role },
  };
}

export async function login(input: LoginInput,metadata:SessionMetadata) {
  const user = await findUserByEmail(input.email);

  if (!user) {
    throw new AppError(
      401,
      "Email hoặc mật khẩu không chính xác",
      "INVALID_CREDENTIALS",
    );
  }

  if (!user.is_active) {
    throw new AppError(
      403,
      "Tài khoản đã bị khóa",
      "ACCOUNT_DISABLED",
    );
  }

  const passwordMatches = user.password_hash !== null && await bcrypt.compare(
    input.password,
    user.password_hash,
  );

  if (!passwordMatches) {
    throw new AppError(
      401,
      "Email hoặc mật khẩu không chính xác",
      "INVALID_CREDENTIALS",
    );
  }

  return issueSession(user, metadata);
}

export async function loginWithGoogle(idToken: string, metadata: SessionMetadata) {
  const identity = await verifyGoogleIdentity(idToken);
  const user = await findGoogleStaffBySub(identity.sub)
    ?? await registerPendingGoogleStaff(identity);

  if (!user) {
    // A different account already owns the verified email. Never link by email.
    throw new AppError(409, "Email đã thuộc một tài khoản khác", "GOOGLE_EMAIL_CONFLICT");
  }
  if (user.staff_approval_status === "pending") {
    return { status: "pending" as const };
  }
  if (user.staff_approval_status === "rejected") {
    throw new AppError(403, "Tài khoản chưa được cấp quyền Staff", "STAFF_NOT_APPROVED");
  }
  if (!user.is_active) {
    throw new AppError(403, "Tài khoản Staff đã bị vô hiệu hóa", "ACCOUNT_DISABLED");
  }
  return { status: "approved" as const, session: await issueSession(user, metadata) };
}

export async function getCurrentUser(userId: number) {
  const user = await findActiveUserById(userId);

  if (!user) {
    throw new AppError(
      401,
      "Tài khoản không tồn tại hoặc đã bị khóa",
      "UNAUTHORIZED",
    );
  }

  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
  };
}

export async function refreshSession(rawToken:string|undefined,metadata:SessionMetadata){
  const parsed=parseRefreshToken(rawToken);if(!parsed)throw new AppError(401,"Invalid session","INVALID_SESSION");
  const connection=await pool.getConnection();
  try{await connection.beginTransaction();const session=await lockSession(connection,parsed.id);
    const supplied=Buffer.from(hashToken(parsed.secret),"hex");const stored=session?Buffer.from(session.token_hash,"hex"):Buffer.alloc(32);
    const valid=session&&!session.revoked_at&&session.expires_at>new Date()&&supplied.length===stored.length&&crypto.timingSafeEqual(supplied,stored);
    if(!valid){await connection.rollback();if(session?.revoked_at)await revokeSession(parsed.id);throw new AppError(401,"Session expired or revoked","SESSION_EXPIRED");}
    const user=await findActiveUserById(session.user_id);if(!user){await connection.rollback();throw new AppError(401,"Account unavailable","UNAUTHORIZED");}
    const next=newRefreshToken();await replaceSession(connection,session.id,next.id,user.id,next.hash,session.expires_at,metadata.userAgent,metadata.ip);await connection.commit();
    return {accessToken:signAccessToken({userId:user.id,email:user.email,role:user.role}),refreshToken:next.value,user:{id:user.id,fullName:user.full_name,email:user.email,role:user.role}};
  }catch(error){try{await connection.rollback();}catch{}throw error;}finally{connection.release();}
}

export async function logoutSession(rawToken:string|undefined){const parsed=parseRefreshToken(rawToken);if(parsed)await revokeSession(parsed.id);}

export async function updateAdminProfile(userId: number, input: UpdateAdminProfileInput) {
  const user = await updateAdminFullName(userId, input.fullName);
  if (!user) throw AppError.notFound("Không tìm thấy tài khoản Admin.", "ADMIN_NOT_FOUND");
  return { id: user.id, fullName: user.full_name, email: user.email, role: user.role };
}

const INVALID_RESET = () => new AppError(400, "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.", "RESET_TOKEN_INVALID");

/**
 * Forgot-password request. The answer never reveals whether the email belongs to an account:
 * only an active Admin with a local password gets a link, the mail is sent after the response
 * (outside any transaction), and a repeated request within the email cooldown sends nothing more.
 */
export async function requestPasswordReset(input: PasswordResetRequestInput, ip: string) {
  try {
    enforceEmailRateLimit("password_reset", input.email, ip);
  } catch (error) {
    if (error instanceof EmailRateLimitError) return; // the earlier link is still valid
    throw error;
  }
  const user = await findUserByEmail(input.email);
  if (!user || user.role !== "admin" || !user.is_active || !user.password_hash) return;
  const { token, expiresAt } = createResetToken(user.id, user.password_hash);
  const link = `${env.CLIENT_URL}/reset-password#token=${encodeURIComponent(token)}`;
  setImmediate(() => {
    sendPasswordResetEmail({ recipient: user.email, fullName: user.full_name, link, expiresAt, ttlMinutes: RESET_TTL_MINUTES })
      // Never log the recipient, link or token.
      .catch((error: unknown) => console.error("Password reset email failed:", error instanceof Error ? error.name : "unknown"));
  });
}

/** Sets a new Admin password from a reset link, then revokes every session of that account. */
export async function confirmPasswordReset(input: PasswordResetConfirmInput) {
  const parsed = parseResetToken(input.token);
  if (!parsed) throw INVALID_RESET();
  const nextHash = await bcrypt.hash(input.newPassword, 12);
  await transaction(async (connection) => {
    const user = await lockActiveAdmin(connection, parsed.userId);
    if (!user?.password_hash || !verifyResetToken(parsed, user.password_hash)) throw INVALID_RESET();
    if (await bcrypt.compare(input.newPassword, user.password_hash)) {
      throw new AppError(400, "Mật khẩu mới phải khác mật khẩu hiện tại.", "PASSWORD_REUSED");
    }
    await replacePasswordAndRevokeSessions(connection, user.id, nextHash);
  });
}

export async function changeAdminPassword(userId: number, input: ChangeAdminPasswordInput) {
  const nextHash = await bcrypt.hash(input.newPassword, 12);
  await transaction(async (connection) => {
    const user = await lockActiveAdmin(connection, userId);
    if (!user?.password_hash) {
      throw new AppError(400, "Tài khoản này không hỗ trợ đổi mật khẩu.", "PASSWORD_NOT_AVAILABLE");
    }
    if (!await bcrypt.compare(input.currentPassword, user.password_hash)) {
      throw new AppError(400, "Mật khẩu hiện tại không chính xác.", "CURRENT_PASSWORD_INVALID");
    }
    await replacePasswordAndRevokeSessions(connection, userId, nextHash);
  });
}
