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