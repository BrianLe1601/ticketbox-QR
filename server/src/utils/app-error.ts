export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Object.setPrototypeOf(this, AppError.prototype);
    }

    static notFound(message = 'Không tìm thấy dữ liệu') {
        return new AppError(message, 404);
    }

    static badRequest(message = 'Yêu cầu không hợp lệ') {
        return new AppError(message, 400);
    }
}