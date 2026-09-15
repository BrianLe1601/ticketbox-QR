import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useAuth } from "@/context/AuthContext";
import { cyberAudio } from "@/lib/cyber-audio";
import type { AuthUser } from "@/types/auth";

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must contain at least 8 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onLoginSuccess?: (user: AuthUser, redirectPath: string) => void;
  onAuthenticatingChange?: (isAuthenticating: boolean) => void;
  isOpeningGate?: boolean;
}

export function LoginForm({
  onLoginSuccess,
  onAuthenticatingChange,
  isOpeningGate = false,
}: LoginFormProps) {
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
    onAuthenticatingChange?.(true);
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
      cyberAudio.playAccessDenied();
      setServerError(
        error instanceof Error ? error.message : "Unable to sign in",
      );
      onAuthenticatingChange?.(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <label className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="email">
          <span>Security Identifier (Email)</span>
          <span className="text-[10px] text-cyan-400/80 font-mono">AUTH.ID</span>
        </label>
        <div className="tech-input-wrap">
          <Mail size={18} aria-hidden="true" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="admin@ticketbox.local"
            disabled={isSubmitting || isOpeningGate}
            {...register("email")}
          />
        </div>
        {errors.email && <p className="tech-field-error">{errors.email.message}</p>}
      </div>

      <div>
        <label className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="password">
          <span>Encrypted Passcode</span>
          <span className="text-[10px] text-cyan-400/80 font-mono">256-BIT</span>
        </label>
        <div className="tech-input-wrap">
          <LockKeyhole size={18} aria-hidden="true" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your security passcode"
            disabled={isSubmitting || isOpeningGate}
            {...register("password")}
          />
          <button
            type="button"
            className="tech-password-toggle"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
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

      {isOpeningGate && (
        <div className="tech-login-success flex items-center gap-2.5 p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 text-xs font-mono">
          <ShieldCheck size={18} className="animate-pulse text-emerald-400" />
          <span>ACCESS GRANTED // AIRLOCK DEPRESSURIZING...</span>
        </div>
      )}

      <button
        className="tech-login-button group relative overflow-hidden"
        type="submit"
        disabled={isSubmitting || isOpeningGate}
      >
        <span className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-white/20 to-cyan-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
        {isOpeningGate ? (
          <>
            <ShieldCheck size={19} className="text-emerald-300 animate-bounce" />
            <span className="font-mono tracking-wider">Access Granted - Entering Gate...</span>
          </>
        ) : isSubmitting ? (
          <>
            <LoaderCircle className="animate-spin text-cyan-300" size={19} />
            <span className="font-mono tracking-wider">Verifying Credentials...</span>
          </>
        ) : (
          <>
            <LockKeyhole size={18} />
            <span>Engage Gate & Sign In</span>
          </>
        )}
      </button>
    </form>
  );
}
