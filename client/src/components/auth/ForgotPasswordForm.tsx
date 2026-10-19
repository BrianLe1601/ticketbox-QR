import { ArrowLeft, LoaderCircle, Mail, MailCheck, Send, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { requestPasswordReset } from "@/services/auth.service";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Admin "Quên mật khẩu?" inside the ticket. The server answers the same way for any email, so the
 * confirmation never says whether an account exists.
 */
export function ForgotPasswordForm({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const invalid = !EMAIL.test(email.trim());

  useEffect(() => { headingRef.current?.focus(); }, [sent]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (invalid || sending) return;
    setSending(true);
    setError(null);
    try {
      setSent(await requestPasswordReset(email.trim()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không gửi được yêu cầu. Vui lòng thử lại.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <section className="login-forgot" aria-labelledby="forgot-title">
        <span className="login-forgot-icon" aria-hidden="true"><MailCheck size={22} /></span>
        <h2 id="forgot-title" ref={headingRef} tabIndex={-1}>Kiểm tra hộp thư của bạn</h2>
        <p role="status">{sent}</p>
        <ul className="login-forgot-tips">
          <li>Liên kết dùng được <strong>một lần</strong> trong <strong>30 phút</strong>.</li>
          <li>Không thấy email? Xem cả mục Thư rác/Quảng cáo, hoặc gửi lại sau 1 phút.</li>
          <li>Đặt lại xong, mọi phiên đăng nhập cũ sẽ bị đăng xuất.</li>
        </ul>
        <div className="login-pending-actions">
          <button type="button" className="login-submit" onClick={onBack}>
            <ArrowLeft size={18} aria-hidden="true" /><span>Quay lại đăng nhập</span>
          </button>
          <button type="button" className="login-ghost" onClick={() => { setSent(null); setTouched(false); }}>
            <Send size={18} aria-hidden="true" /><span>Gửi lại</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="login-forgot" aria-labelledby="forgot-title">
      <h2 id="forgot-title" ref={headingRef} tabIndex={-1}>Quên mật khẩu Quản trị</h2>
      <p>Nhập email quản trị. Nếu email thuộc một tài khoản Quản trị, chúng tôi gửi liên kết để đặt mật khẩu mới.</p>
      <form className="login-form" onSubmit={submit} noValidate>
        <div className="login-field">
          <label htmlFor="forgot-email">Email quản trị</label>
          <div className="login-input">
            <Mail size={18} aria-hidden="true" />
            <input
              id="forgot-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="admin@ticketbox.vn"
              value={email}
              disabled={sending}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && invalid}
              aria-describedby={touched && invalid ? "forgot-email-error" : undefined}
            />
          </div>
          {touched && invalid && <p id="forgot-email-error" className="login-field-error" role="alert">Vui lòng nhập đúng địa chỉ email hợp lệ</p>}
        </div>

        {error && (
          <div className="login-notice danger" role="alert">
            <ShieldAlert size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <button className="login-submit" type="submit" disabled={sending}>
          {sending ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
          <span>{sending ? "Đang gửi…" : "Gửi liên kết đặt lại"}</span>
        </button>
        <button type="button" className="login-link-button" onClick={onBack} disabled={sending}>
          <ArrowLeft size={16} aria-hidden="true" />Quay lại đăng nhập
        </button>
      </form>
      <p className="login-forgot-note">Nhân viên cổng đăng nhập bằng Google nên không cần mật khẩu. Nhân viên có tài khoản mật khẩu: liên hệ Quản trị viên.</p>
    </section>
  );
}
