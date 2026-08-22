import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useAuth } from "@/context/AuthContext";

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must contain at least 8 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
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
      navigate(requestedPath ?? defaultPath, { replace: true });
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Unable to sign in",
      );
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="email">
          Administrator email
        </label>
        <div className="tech-input-wrap">
          <Mail size={18} aria-hidden="true" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="admin@ticketbox.local"
            {...register("email")}
          />
        </div>
        {errors.email && <p className="tech-field-error">{errors.email.message}</p>}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="password">
          Password
        </label>
        <div className="tech-input-wrap">
          <LockKeyhole size={18} aria-hidden="true" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            {...register("password")}
          />
          <button
            type="button"
            className="tech-password-toggle"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.password && <p className="tech-field-error">{errors.password.message}</p>}
      </div>

      {serverError && (
        <div className="tech-login-error" role="alert">
          {serverError}
        </div>
      )}

      <button className="tech-login-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? <LoaderCircle className="animate-spin" size={19} /> : <LockKeyhole size={18} />}
        {isSubmitting ? "Authenticating..." : "Sign in to system"}
      </button>
    </form>
  );
}
