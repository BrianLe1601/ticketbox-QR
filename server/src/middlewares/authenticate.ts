import type { NextFunction, Request, Response } from "express";

import { findActiveUserById } from "../modules/auth/auth.repository.js";
import { AppError } from "../utils/app-error.js";
import { verifyAccessToken } from "../utils/jwt.js";

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new AppError(
        401,
        "Bạn chưa đăng nhập",
        "TOKEN_REQUIRED",
      );
    }

    const token = authorization.slice(7).trim();
    const payload = verifyAccessToken(token);

    const user = await findActiveUserById(payload.userId);

    if (!user) {
      throw new AppError(
        401,
        "Tài khoản không tồn tại hoặc đã bị khóa",
        "UNAUTHORIZED",
      );
    }

    req.authUser = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error: unknown) {
    next(error);
  }
}