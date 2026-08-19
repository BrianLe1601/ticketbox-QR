export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(statusCode: number, message: string, code = "APP_ERROR") {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Object.setPrototypeOf(this, AppError.prototype);
    }

    static notFound(message = "Không tìm thấy dữ liệu", code = "NOT_FOUND") {
        return new AppError(404, message, code);
    }

    static badRequest(message = "Yêu cầu không hợp lệ", code = "BAD_REQUEST") {
        return new AppError(400, message, code);
    }
}