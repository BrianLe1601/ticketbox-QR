const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

interface ApiSuccess<T> {
    success: true;
    data: T;
    meta?: { total: number; page: number; limit: number };
}

interface ApiError {
    success: false;
    message: string;
}

export class ApiRequestError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

export async function apiGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<{ data: T; meta?: ApiSuccess<T>["meta"] }> {
    const url = new URL(`${API_BASE_URL}${path}`);
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
        });
    }

    const res = await fetch(url.toString());
    const json = (await res.json()) as ApiSuccess<T> | ApiError;

    if (!res.ok || !json.success) {
        const message = "message" in json ? json.message : `Request failed (${res.status})`;
        throw new ApiRequestError(message, res.status);
    }

    return { data: json.data, meta: json.meta };
}

export async function apiPost<T>(path: string, body: unknown): Promise<{ data: T }> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const json = (await res.json()) as ApiSuccess<T> | ApiError;

    if (!res.ok || !json.success) {
        const message = "message" in json ? json.message : `Request failed (${res.status})`;
        throw new ApiRequestError(message, res.status);
    }

    return { data: json.data };
}