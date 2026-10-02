import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Email không hợp lệ")
    .max(150)
    .transform((value) => value.toLowerCase()),

  password: z
    .string()
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
    .max(100),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const googleLoginSchema = z.object({
  idToken: z.string().min(100).max(8192),
});

export const updateAdminProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Họ tên phải có ít nhất 2 ký tự").max(100),
}).strict();

export const changeAdminPasswordSchema = z.object({
  currentPassword: z.string().min(8, "Mật khẩu hiện tại không hợp lệ").max(100),
  newPassword: z.string()
    .min(8, "Mật khẩu mới phải có ít nhất 8 ký tự")
    .max(100)
    .regex(/[a-z]/, "Mật khẩu mới phải có chữ thường")
    .regex(/[0-9]/, "Mật khẩu mới phải có chữ số")
    .regex(/[^\p{L}\p{N}\s]/u, "Mật khẩu mới phải có ít nhất 1 ký tự đặc biệt"),
}).strict().refine(
  (value) => value.currentPassword !== value.newPassword,
  { path: ["newPassword"], message: "Mật khẩu mới phải khác mật khẩu hiện tại" },
);

export type UpdateAdminProfileInput = z.infer<typeof updateAdminProfileSchema>;
export type ChangeAdminPasswordInput = z.infer<typeof changeAdminPasswordSchema>;
