import bcrypt from "bcrypt";

import { AppError } from "../../utils/app-error.js";
import { signAccessToken } from "../../utils/jwt.js";
import {
  findActiveUserById,
  findUserByEmail,
} from "./auth.repository.js";
import type { LoginInput } from "./auth.schema.js";

export async function login(input: LoginInput) {
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

  return {
    accessToken,
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