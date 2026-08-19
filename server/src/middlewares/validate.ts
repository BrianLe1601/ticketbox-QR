import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '../utils/app-error.js';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
    return (req: Request, _res: Response, next: NextFunction) => {
        const result = schema.safeParse(req[source]);
        if (!result.success) {
            const message = result.error.issues.map((e) => e.message).join(', ');
            return next(AppError.badRequest(message));
        }

        // Express 5: req.query/req.params là getter tính toán lại mỗi lần đọc,
        // không thể gán trực tiếp (`req.query = ...`) và mutate object cũ cũng
        // không giữ được giá trị qua các lần đọc sau. Phải dùng defineProperty
        // để thay hẳn getter bằng giá trị tĩnh đã validate/coerce.
        Object.defineProperty(req, source, {
            value: result.data,
            writable: true,
            configurable: true,
            enumerable: true,
        });

        next();
    };
}