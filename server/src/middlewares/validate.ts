import type { NextFunction, Request, Response } from "express";
import type { ZodSchema, ZodType } from "zod";
import { AppError } from "../utils/app-error.js";

/**
 * Validate + coerce req.query / req.params / req.body theo schema.
 * Dùng defineProperty vì Express 5: req.query/req.params là getter tính lại
 * mỗi lần đọc — gán trực tiếp hoặc mutate object cũ không giữ được giá trị.
 */
export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
    return (req: Request, _res: Response, next: NextFunction) => {
        const result = schema.safeParse(req[source]);
        if (!result.success) {
            const message = result.error.issues.map((e) => e.message).join(", ");
            return next(AppError.badRequest(message));
        }

        Object.defineProperty(req, source, {
            value: result.data,
            writable: true,
            configurable: true,
            enumerable: true,
        });

        next();
    };
}

/**
 * Validate riêng cho req.body (module auth). req.body luôn writable trực
 * tiếp kể cả ở Express 5 nên không cần defineProperty.
 */
export function validateBody(schema: ZodType) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            res.status(400).json({
                success: false,
                message: "Dữ liệu không hợp lệ",
                errors: result.error.flatten().fieldErrors,
            });

            return;
        }

        req.body = result.data;
        next();
    };
}