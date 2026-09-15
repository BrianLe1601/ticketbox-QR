import bcrypt from "bcrypt";
import crypto from "node:crypto";

import { AppError } from "../../utils/app-error.js";
import { signAccessToken } from "../../utils/jwt.js";
import {
  findActiveUserById,
  findUserByEmail,
} from "./auth.repository.js";
import type { LoginInput } from "./auth.schema.js";
import { createSession, lockSession, pool, replaceSession, revokeSession } from "./auth-session.repository.js";
import { hashToken, newRefreshToken, parseRefreshToken, refreshExpiry } from "./refresh-token.js";

type SessionMetadata={userAgent:string|null;ip:string|null};

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

  const passwordMatches = await bcrypt.compare(
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

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  const refreshToken=newRefreshToken();
  await createSession(refreshToken.id,user.id,refreshToken.hash,refreshExpiry(),metadata.userAgent,metadata.ip);

  return {
    accessToken,
    refreshToken:refreshToken.value,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
    },
  };
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
