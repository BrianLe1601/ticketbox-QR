import { z } from "zod";

const emailField = z
  .string()
  .trim()
  .email("Email không hợp lệ")
  .max(150)
  .transform((value) => value.toLowerCase());

/** Server password rules shared by the Admin password change and the password reset. */
const newPasswordField = z.string()
  .min(8, "Mật khẩu mới phải có ít nhất 8 ký tự")
  .max(100)
  .regex(/[a-z]/, "Mật khẩu mới phải có chữ thường")
  .regex(/[0-9]/, "Mật khẩu mới phải có chữ số")
  .regex(/[^\p{L}\p{N}\s]/u, "Mật khẩu mới phải có ít nhất 1 ký tự đặc biệt");

export const loginSchema = z.object({
  email: emailField,

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
  newPassword: newPasswordField,
}).strict().refine(
  (value) => value.currentPassword !== value.newPassword,
  { path: ["newPassword"], message: "Mật khẩu mới phải khác mật khẩu hiện tại" },
);

export const passwordResetRequestSchema = z.object({ email: emailField }).strict();

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: newPasswordField,
}).strict();

export type UpdateAdminProfileInput = z.infer<typeof updateAdminProfileSchema>;
export type ChangeAdminPasswordInput = z.infer<typeof changeAdminPasswordSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
