import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowBigUp, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldAlert } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
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
  emailLabel?: string;
  emailPlaceholder?: string;
  submitLabel?: string;
  /** Shows "Quên mật khẩu?" next to the password label (Admin only); receives the typed email. */
  onForgotPassword?: (email: string) => void;
}

export function LoginForm({
  onLoginSuccess,
  emailLabel = "Địa chỉ email",
  emailPlaceholder = "ten@congty.com",
  submitLabel = "Đăng nhập",
  onForgotPassword,
}: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [capsLock, setCapsLock] = useState(false);
  const readCaps = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState("CapsLock"));
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    register,
    handleSubmit,
    getValues,
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
        error instanceof Error ? error.message : "Đăng nhập không thành công. Vui lòng thử lại.",
      );
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="login-field">
        <label htmlFor="email">{emailLabel}</label>
        <div className="login-input">
          <Mail size={18} aria-hidden="true" />
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={emailPlaceholder}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
        </div>
        {errors.email && <p id="email-error" className="login-field-error" role="alert">{errors.email.message}</p>}
      </div>

      <div className="login-field">
        <div className="login-label-row">
          <label htmlFor="password">Mật khẩu</label>
          {onForgotPassword && (
            <button type="button" className="login-link-button" onClick={() => onForgotPassword(getValues("email").trim())} disabled={isSubmitting}>
              Quên mật khẩu?
            </button>
          )}
        </div>
        <div className="login-input">
          <LockKeyhole size={18} aria-hidden="true" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Tối thiểu 8 ký tự"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={[errors.password && "password-error", capsLock && "password-caps"].filter(Boolean).join(" ") || undefined}
            onKeyDown={readCaps}
            onKeyUp={readCaps}
            {...register("password", { onBlur: () => setCapsLock(false) })}
          />
          <button
            type="button"
            className="login-password-toggle"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
        {capsLock && (
          <p id="password-caps" className="login-caps" role="status">
            <ArrowBigUp size={16} aria-hidden="true" />
            Caps Lock đang bật
          </p>
        )}
        {errors.password && <p id="password-error" className="login-field-error" role="alert">{errors.password.message}</p>}
      </div>

      {serverError && (
        <div className="login-notice danger" role="alert">
          <ShieldAlert size={18} aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      )}

      <button className="login-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
            <span>Đang xác thực…</span>
          </>
        ) : (
          <>
            <LockKeyhole size={18} aria-hidden="true" />
            <span>{submitLabel}</span>
          </>
        )}
      </button>
    </form>
  );
}
