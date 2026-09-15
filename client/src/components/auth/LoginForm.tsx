import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useAuth } from "@/context/AuthContext";
import type { AuthUser } from "@/types/auth";

const loginSchema = z.object({
  email: z.string().trim().email("Vui lòng nhập đúng địa chỉ email"),
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onLoginSuccess?: (user: AuthUser, redirectPath: string) => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormData) {
    setServerError(null);
    try {
      const user = await login(values);
      const requestedPath = (location.state as { from?: string } | null)?.from;
      const defaultPath = user.role === "admin" ? "/admin" : "/staff";
      const targetPath = requestedPath ?? defaultPath;

      if (onLoginSuccess) {
        onLoginSuccess(user, targetPath);
      } else {
        navigate(targetPath, { replace: true });
      }
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Unable to sign in",
      );
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <label className="mb-2 flex items-center text-xs font-semibold text-slate-300" htmlFor="email">
          <span>Email</span>
        </label>
        <div className="tech-input-wrap">
          <Mail size={18} aria-hidden="true" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="admin@ticketbox.local"
            disabled={isSubmitting}
            {...register("email")}
          />
        </div>
        {errors.email && <p className="tech-field-error">{errors.email.message}</p>}
      </div>

      <div>
        <label className="mb-2 flex items-center text-xs font-semibold text-slate-300" htmlFor="password">
          <span>Mật khẩu</span>
        </label>
        <div className="tech-input-wrap">
          <LockKeyhole size={18} aria-hidden="true" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Nhập mật khẩu"
            disabled={isSubmitting}
            {...register("password")}
          />
          <button
            type="button"
            className="tech-password-toggle"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.password && <p className="tech-field-error">{errors.password.message}</p>}
      </div>

      {serverError && (
        <div className="tech-login-error flex items-start gap-2.5" role="alert">
          <ShieldAlert size={18} className="flex-shrink-0 mt-0.5 text-rose-400" />
          <span className="text-xs leading-relaxed">{serverError}</span>
        </div>
      )}

      <button
        className="tech-login-button"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <LoaderCircle className="animate-spin text-cyan-300" size={19} />
            <span>Đang xác thực...</span>
          </>
        ) : (
          <>
            <LockKeyhole size={18} />
            <span>Đăng nhập</span>
          </>
        )}
      </button>
    </form>
  );
}
