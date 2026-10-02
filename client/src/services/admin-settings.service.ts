import { apiRequest } from "@/services/api";
import type { AuthUser } from "@/types/auth";

export async function updateAdminProfile(fullName: string, token: string | null) {
  return apiRequest<{ user: AuthUser }>("/auth/admin/profile", {
    method: "PATCH",
    body: JSON.stringify({ fullName }),
  }, token);
}

export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string,
  token: string | null,
) {
  return apiRequest<null>("/auth/admin/password", {
    method: "PATCH",
    body: JSON.stringify({ currentPassword, newPassword }),
  }, token);
}
