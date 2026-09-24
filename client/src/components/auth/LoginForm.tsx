import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldAlert, Sparkles } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useAuth } from "@/context/AuthContext";
import type { AuthUser } from "@/types/auth";

const loginSchema = z.object({
  email: z.string().trim().email("Vui lòng nhập đúng địa chỉ email hợp lệ"),
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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  function fillDemoAdmin() {
    setValue("email", "admin@ticketbox.local", { shouldValidate: true });
    setValue("password", "ticketbox@123", { shouldValidate: true });
    setServerError(null);
  }

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
        error instanceof Error ? error.message : "Đăng nhập không thành công. Vui lòng thử lại.",
      );
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* 1-Click Demo Fill Button */}
      <button
        type="button"
        className="auth-quick-fill-btn"
        onClick={fillDemoAdmin}
        title="Bấm để tự động điền tài khoản Admin thử nghiệm"
      >
        <Sparkles size={13} className="text-cyan-400" />
        <span>Điền nhanh tài khoản Admin mẫu (admin@ticketbox.local)</span>
      </button>

      <div>
        <label
          className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-300"
          htmlFor="email"
        >
          <span>Địa chỉ Email</span>
          <span className="text-[10px] font-normal text-slate-500">Bắt buộc</span>
        </label>
        <div className="tech-input-wrap">
          <Mail size={17} aria-hidden="true" className="text-slate-400" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="admin@ticketbox.local hoặc staff@ticketbox.local"
            disabled={isSubmitting}
            {...register("email")}
          />
        </div>
        {errors.email && <p className="tech-field-error">{errors.email.message}</p>}
      </div>

      <div>
        <label
          className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-300"
          htmlFor="password"
        >
          <span>Mật khẩu</span>
          <span className="text-[10px] font-normal text-slate-500">Tối thiểu 8 ký tự</span>
        </label>
        <div className="tech-input-wrap">
          <LockKeyhole size={17} aria-hidden="true" className="text-slate-400" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Nhập mật khẩu tài khoản"
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
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {errors.password && <p className="tech-field-error">{errors.password.message}</p>}
      </div>

      {serverError && (
        <div className="tech-login-error flex items-start gap-2.5" role="alert">
          <ShieldAlert size={17} className="flex-shrink-0 mt-0.5 text-rose-400" />
          <span className="text-xs leading-relaxed">{serverError}</span>
        </div>
      )}

      <button className="tech-login-button mt-2" type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <LoaderCircle className="animate-spin text-cyan-300" size={18} />
            <span>Đang xác thực thông tin...</span>
          </>
        ) : (
          <>
            <LockKeyhole size={17} />
            <span>Đăng nhập hệ thống</span>
          </>
        )}
      </button>
    </form>
  );
}
