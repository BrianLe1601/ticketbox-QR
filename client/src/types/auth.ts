export type UserRole = "admin" | "staff";

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

export interface AuthResponse {
  success: true;
  message: string;
  data: LoginResult;
}

export interface MeResponse {
  success: true;
  message: string;
  data: { user: AuthUser };
}
