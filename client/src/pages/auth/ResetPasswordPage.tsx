import { Check, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, ShieldAlert, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { AuthShell } from "@/components/auth/AuthShell";
import { resetFormErrors, resetPasswordChecks, tokenFromHash } from "@/lib/login-flow";
import { AuthRequestError, confirmPasswordReset } from "@/services/auth.service";
import { useTheme } from "@/lib/ticketbox-theme";


export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme("login");
  // The token lives only in the #fragment (never sent to the server in a URL); kept in memory.
  const [token] = useState(() => tokenFromHash(window.location.hash));
  const [form, setForm] = useState({ next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(!token);
  const checks = resetPasswordChecks(form.next);
  const errors = touched ? resetFormErrors(form) : {};

  // Remove #token=… from the address bar and this history entry once it has been read.
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname);
  }, []);
  useEffect(() => { document.getElementById(linkInvalid ? "reset-title" : "reset-next")?.focus(); }, [linkInvalid]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!token || saving || Object.keys(resetFormErrors(form)).length) return;
    setSaving(true);
    setError(null);
    try {
      await confirmPasswordReset(token, form.next);
      navigate("/login", { replace: true, state: { notice: "Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới." } });
    } catch (cause) {
      if (cause instanceof AuthRequestError && cause.code === "RESET_TOKEN_INVALID") setLinkInvalid(true);
      else setError(cause instanceof Error ? cause.message : "Không đặt lại được mật khẩu. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthShell theme={theme} onToggleTheme={toggle} title="Đặt lại mật khẩu" subtitle="Chọn mật khẩu mới cho tài khoản Quản trị TicketBox.">
      <div className="login-panel login-panel--pending">
        {linkInvalid ? (
          <section className="login-forgot" aria-labelledby="reset-title">
            <span className="login-forgot-icon is-danger" aria-hidden="true"><ShieldAlert size={22} /></span>
            <h2 id="reset-title" tabIndex={-1}>Liên kết không còn dùng được</h2>
            <p>Liên kết đặt lại mật khẩu không hợp lệ, đã hết hạn sau 30 phút hoặc đã được dùng. Hãy gửi yêu cầu mới.</p>
            <div className="login-pending-actions">
              <button type="button" className="login-submit" onClick={() => navigate("/login", { replace: true, state: { forgot: true } })}>
                <KeyRound size={18} aria-hidden="true" /><span>Gửi liên kết mới</span>
              </button>
              <button type="button" className="login-ghost" onClick={() => navigate("/login", { replace: true })}>
                <span>Về trang đăng nhập</span>
              </button>
            </div>
          </section>
        ) : (
          <form className="login-form" onSubmit={submit} noValidate>
            <div className="login-field">
              <label htmlFor="reset-next">Mật khẩu mới</label>
              <div className="login-input">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  id="reset-next"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.next}
                  disabled={saving}
                  onChange={(event) => setForm({ ...form, next: event.target.value })}
                  aria-invalid={Boolean(errors.next)}
                  aria-describedby="reset-rules"
                />
                <button type="button" className="login-password-toggle" onClick={() => setShow((value) => !value)} aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={show}>
                  {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
              <ul id="reset-rules" className="login-rules" aria-label="Yêu cầu mật khẩu">
                {checks.map((check) => (
                  <li key={check.id} className={check.ok ? "is-ok" : undefined}>
                    {check.ok ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                    <span>{check.label}<span className="sr-only">{check.ok ? " — đạt" : " — chưa đạt"}</span></span>
                  </li>
                ))}
              </ul>
              {errors.next && <p className="login-field-error" role="alert">{errors.next}</p>}
            </div>

            <div className="login-field">
              <label htmlFor="reset-confirm">Nhập lại mật khẩu mới</label>
              <div className="login-input">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  id="reset-confirm"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.confirm}
                  disabled={saving}
                  onChange={(event) => setForm({ ...form, confirm: event.target.value })}
                  aria-invalid={Boolean(errors.confirm)}
                  aria-describedby={errors.confirm ? "reset-confirm-error" : undefined}
                />
              </div>
              {errors.confirm && <p id="reset-confirm-error" className="login-field-error" role="alert">{errors.confirm}</p>}
            </div>

            {error && (
              <div className="login-notice danger" role="alert">
                <ShieldAlert size={18} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <p className="login-forgot-note">Sau khi đổi, mọi phiên đăng nhập của tài khoản này sẽ bị đăng xuất.</p>
            <button className="login-submit" type="submit" disabled={saving}>
              {saving ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}
              <span>{saving ? "Đang lưu…" : "Đặt mật khẩu mới"}</span>
            </button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
