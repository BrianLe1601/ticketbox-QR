import { Check, Lightbulb } from "lucide-react";
import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { GoogleStaffLogin } from "@/components/auth/GoogleStaffLogin";
import { LoginForm } from "@/components/auth/LoginForm";
import { StaffPendingCard } from "@/components/auth/StaffPendingCard";
import { useAuth } from "@/context/AuthContext";
import { readLastEntry, saveLastEntry, type LoginEntry } from "@/lib/login-flow";
import { useTheme } from "@/lib/ticketbox-theme";
import type { AuthUser } from "@/types/auth";

const entries: Array<{ id: LoginEntry; label: string; hint: string }> = [
  { id: "admin", label: "Quản trị viên", hint: "Điều hành, doanh thu & duyệt nhân sự" },
  { id: "staff", label: "Nhân viên cổng", hint: "Dùng Gmail cá nhân · chờ Admin duyệt" },
];

export function LoginPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { notice?: string; forgot?: boolean } | null;
  const notice = routeState?.notice;
  const { theme, toggle } = useTheme("login");
  // A reset link that no longer works sends the Admin back here with the forgot form open.
  const [entry, setEntry] = useState<LoginEntry>(() => (routeState?.forgot ? "admin" : readLastEntry()));
  const [forgotEmail, setForgotEmail] = useState<string | null>(() => (routeState?.forgot ? "" : null));
  // Google credential of a Staff login that is still awaiting approval; memory only, never stored.
  const [pendingCredential, setPendingCredential] = useState<string | null>(null);
  const tabRefs = useRef<Record<LoginEntry, HTMLButtonElement | null>>({ admin: null, staff: null });
  const baseId = useId();

  const handleLoginSuccess = useCallback((authenticatedUser: AuthUser, requestedPath: string) => {
    saveLastEntry(authenticatedUser.role === "admin" ? "admin" : "staff");
    const destination =
      authenticatedUser.role === "admin"
        ? "/admin"
        : requestedPath.startsWith("/staff")
        ? requestedPath
        : "/staff";
    navigate(destination, { replace: true });
  }, [navigate]);
  const handlePending = useCallback((credential: string) => {
    saveLastEntry("staff");
    setPendingCredential(credential);
  }, []);

  function switchAccount() {
    setPendingCredential(null);
    setEntry("staff");
    requestAnimationFrame(() => tabRefs.current.staff?.focus());
  }

  function backToLogin() {
    setForgotEmail(null);
    requestAnimationFrame(() => document.getElementById("email")?.focus());
  }

  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next: LoginEntry = event.key === "Home" || event.key === "ArrowLeft" ? "admin" : "staff";
    setEntry(next);
    tabRefs.current[next]?.focus();
  }

  if (!isLoading && user) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/staff"} replace />;
  }

  const panelId = `${baseId}-panel`;
  let body;
  if (pendingCredential) {
    body = (
      <div className="login-panel login-panel--pending">
        <StaffPendingCard credential={pendingCredential} onLoginSuccess={handleLoginSuccess} onSwitchAccount={switchAccount} />
      </div>
    );
  } else if (forgotEmail !== null) {
    body = (
      <div className="login-panel login-panel--pending">
        <ForgotPasswordForm initialEmail={forgotEmail} onBack={backToLogin} />
      </div>
    );
  } else {
    body = (
      <>
        <div className="login-entries" role="tablist" aria-label="Bạn đăng nhập với vai trò nào?" onKeyDown={onTabKey}>
          {entries.map((item) => (
            <button
              key={item.id}
              ref={(element) => { tabRefs.current[item.id] = element; }}
              type="button"
              role="tab"
              id={`${baseId}-${item.id}`}
              aria-selected={entry === item.id}
              aria-controls={panelId}
              tabIndex={entry === item.id ? 0 : -1}
              className="login-entry"
              onClick={() => setEntry(item.id)}
            >
              <span className="login-entry-check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
              <strong>{item.label}</strong>
              <span className="login-entry-hint">{item.hint}</span>
            </button>
          ))}
        </div>

        <div role="tabpanel" id={panelId} aria-labelledby={`${baseId}-${entry}`} className="login-panel" key={entry}>
          {notice && <p className="login-notice success" role="status">{notice}</p>}
          {entry === "admin" ? (
            <>
              <p className="login-panel-note">Nhập tài khoản quản trị để vào Trung tâm điều hành.</p>
              <LoginForm
                onLoginSuccess={handleLoginSuccess}
                emailLabel="Email quản trị"
                emailPlaceholder="admin@ticketbox.vn"
                submitLabel="Đăng nhập Quản trị"
                onForgotPassword={setForgotEmail}
              />
            </>
          ) : (
            <>
              <div className="login-callout">
                <Lightbulb size={18} aria-hidden="true" />
                <div>
                  <strong>Không cần tạo tài khoản trước</strong>
                  <span>
                    Đăng nhập bằng Gmail cá nhân. Lần đầu truy cập, yêu cầu sẽ được gửi tới Quản trị viên phê duyệt;
                    sau khi được duyệt và phân công sự kiện, bạn mở được máy quét khi cổng mở.
                  </span>
                </div>
              </div>
              <GoogleStaffLogin onLoginSuccess={handleLoginSuccess} onPending={handlePending} theme={theme} />
              <div className="login-divider" role="separator"><span>hoặc</span></div>
              <details className="login-local">
                <summary>Đăng nhập bằng tài khoản do Quản trị viên cấp</summary>
                <LoginForm
                  onLoginSuccess={handleLoginSuccess}
                  emailLabel="Email nhân viên"
                  emailPlaceholder="ten.cua.ban@gmail.com"
                />
              </details>
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <AuthShell
      theme={theme}
      onToggleTheme={toggle}
      title="Đăng nhập TicketBox"
      subtitle="Cổng truy cập nội bộ dành riêng cho Quản trị viên và Nhân viên trực sự kiện."
    >
      {body}
    </AuthShell>
  );
}
