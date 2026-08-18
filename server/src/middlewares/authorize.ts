import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/app-error.js";

type UserRole = "admin" | "staff";

export function authorize(...allowedRoles: UserRole[]) {
  return (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void => {
    if (!req.authUser) {
      next(
        new AppError(
          401,
          "Bạn chưa đăng nhập",
          "UNAUTHORIZED",
        ),
      );

      return;
    }

    if (!allowedRoles.includes(req.authUser.role)) {
      next(
        new AppError(
          403,
          "Bạn không có quyền thực hiện chức năng này",
          "FORBIDDEN",
        ),
      );

      return;
    }

    next();
  };
}