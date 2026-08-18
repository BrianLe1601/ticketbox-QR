import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../utils/app-error.js";
import type { LoginInput } from "./auth.schema.js";
import {
  getCurrentUser,
  login,
} from "./auth.service.js";

export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await login(req.body as LoginInput);

    res.status(200).json({
      success: true,
      message: "Đăng nhập thành công",
      data: result,
    });
  } catch (error: unknown) {
    next(error);
  }
}

export async function getMeController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.authUser) {
      throw new AppError(401, "Bạn chưa đăng nhập", "UNAUTHORIZED");
    }

    const user = await getCurrentUser(req.authUser.id);

    res.status(200).json({
      success: true,
      message: "Lấy thông tin tài khoản thành công",
      data: { user },
    });
  } catch (error: unknown) {
    next(error);
  }
}