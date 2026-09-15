import { refreshSessionRequest } from "@/services/auth.service";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

interface ApiSuccess<T> {
    success: true;
    data: T;
    meta?: { total: number; page: number; limit: number };
}

interface ApiError {
    success: false;
    message: string;
    code?: string;
}

export class ApiRequestError extends Error {
    status: number;
    code?: string;

    constructor(message: string, status: number, code?: string) {
        super(message);
        this.status = status;
        this.code = code;
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
        throw new ApiRequestError(message, res.status, "code" in json ? json.code : undefined);
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
        throw new ApiRequestError(message, res.status, "code" in json ? json.code : undefined);
    }

    return { data: json.data };
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<{ data: T; meta?: ApiSuccess<T>["meta"] }> {
    const headers = new Headers(options.headers);
    if (options.body) headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    let res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials:"include" });
    if(res.status===401 && !path.startsWith("/auth/")){
      try{const renewed=await refreshSessionRequest();headers.set("Authorization",`Bearer ${renewed.accessToken}`);res=await fetch(`${API_BASE_URL}${path}`,{...options,headers,credentials:"include"});}catch{/* handled by original response below */}
    }
    if (res.status === 204) return { data: undefined as T };
    const json = (await res.json()) as ApiSuccess<T> | ApiError;
    if (!res.ok || !json.success) {
        throw new ApiRequestError("message" in json ? json.message : `Request failed (${res.status})`, res.status, "code" in json ? json.code : undefined);
    }
    return { data: json.data, meta: json.meta };
}
