import type {
  ErrorRequestHandler,
  RequestHandler,
} from "express";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { AppError } from "../utils/app-error.js";

export const notFoundHandler: RequestHandler = (
  req,
  res,
) => {
  res.status(404).json({
    success: false,
    message: `Không tìm thấy endpoint ${req.method} ${req.originalUrl}`,
  });
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
) => {
  if (error instanceof jwt.TokenExpiredError) {
    res.status(401).json({
      success: false,
      message: "Phiên đăng nhập đã hết hạn",
      code: "TOKEN_EXPIRED",
    });

    return;
  }

  if (error instanceof jwt.JsonWebTokenError) {
    res.status(401).json({
      success: false,
      message: "Token không hợp lệ",
      code: "INVALID_TOKEN",
    });

    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Dữ liệu không hợp lệ",
      errors: error.flatten().fieldErrors,
    });

    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code,
    });

    return;
  }

  console.error(error);

  res.status(500).json({
    success: false,
    message: "Lỗi máy chủ nội bộ",
    code: "INTERNAL_SERVER_ERROR",
  });
};