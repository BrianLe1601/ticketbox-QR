import type { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
    return res.status(statusCode).json({
        success: true,
        data,
    });
}

export function sendPaginated<T>(
    res: Response,
    data: T[],
    meta: { total: number; page: number; limit: number }
) {
    return res.status(200).json({
        success: true,
        data,
        meta,
    });
}