import type {
  AuthResponse,
  LoginCredentials,
  LoginResult,
  MeResponse,
} from "@/types/auth";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

let memoryAccessToken: string | null = null;
let refreshPromise: Promise<LoginResult> | null = null;

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getErrorMessage(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return "Unable to connect to the system. Please try again.";
}

export async function loginRequest(
  credentials: LoginCredentials,
): Promise<LoginResult> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
    credentials: "include",
  });

  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return (payload as AuthResponse).data;
}

export async function getMeRequest(token: string) {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return (payload as MeResponse).data.user;
}

async function performRefresh():Promise<LoginResult>{
  const response=await fetch(`${API_BASE_URL}/auth/refresh`,{method:"POST",credentials:"include"});
  const payload=await readJson(response);if(!response.ok)throw new Error(getErrorMessage(payload));
  const result=(payload as AuthResponse).data;memoryAccessToken=result.accessToken;return result;
}

export function refreshSessionRequest():Promise<LoginResult>{
  if(!refreshPromise)refreshPromise=performRefresh().finally(()=>{refreshPromise=null;});
  return refreshPromise;
}

export async function logoutRequest():Promise<void>{
  try{await fetch(`${API_BASE_URL}/auth/logout`,{method:"POST",credentials:"include"});}finally{memoryAccessToken=null;}
}

export function getStoredToken(): string | null {
  return memoryAccessToken;
}

export function storeToken(token: string): void {
  memoryAccessToken = token;
}

export function clearStoredToken(): void {
  memoryAccessToken = null;
}
