import { Hourglass, LoaderCircle, RefreshCw, ShieldAlert, UserRoundCog } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { checkedAtText, emailFromIdToken } from "@/lib/login-flow";
import type { AuthUser } from "@/types/auth";

/**
 * The "waiting pass" shown instead of the form after a Google login that is still pending.
 * "Làm mới trạng thái" re-sends the same in-memory Google credential; the server decides again
 * (pending / approved / rejected / disabled). Once Google's token expires the server refuses it
 * and the Staff member signs in with Google again through "Đổi tài khoản khác".
 */
export function StaffPendingCard({
  credential,
  onLoginSuccess,
  onSwitchAccount,
}: {
  credential: string;
  onLoginSuccess: (user: AuthUser, requestedPath: string) => void;
  onSwitchAccount: () => void;
}) {
  const { loginWithGoogle } = useAuth();
  const email = emailFromIdToken(credential);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState(() => new Date());
  const [stillPending, setStillPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  async function recheck() {
    if (checking) return;
    setChecking(true);
    setError(null);
    try {
      const result = await loginWithGoogle(credential);
      if (result.status === "approved") {
        onLoginSuccess(result.user, "/staff");
        return;
      }
      setStillPending(true);
      setCheckedAt(new Date());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không kiểm tra được trạng thái. Vui lòng thử lại.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="login-pending" aria-labelledby="login-pending-title">
      <span className="login-pending-badge">
        <Hourglass size={14} aria-hidden="true" />
        Đang chờ phê duyệt
      </span>
      <h2 id="login-pending-title" ref={titleRef} tabIndex={-1}>Yêu cầu trực cổng đã được gửi</h2>
      <p>
        {email ? <>Tài khoản <strong className="login-pending-email">{email}</strong></> : "Tài khoản Google của bạn"}{" "}
        đã có trong mục <strong>Nhân viên chờ duyệt</strong>. Hãy báo Quản trị viên duyệt tại trang Nhân viên.
      </p>
      <ol className="login-pending-steps">
        <li className="is-done">Đăng nhập bằng Gmail cá nhân</li>
        <li className="is-current">Quản trị viên duyệt tài khoản</li>
        <li>Được phân công sự kiện, mở máy quét khi cổng mở</li>
      </ol>

      <p className="login-pending-status" role="status" aria-live="polite">
        {checking
          ? "Đang kiểm tra…"
          : stillPending
          ? `Vẫn đang chờ duyệt · kiểm tra lúc ${checkedAtText(checkedAt)}`
          : `Đã ghi nhận lúc ${checkedAtText(checkedAt)}`}
      </p>

      {error && (
        <div className="login-notice danger" role="alert">
          <ShieldAlert size={18} aria-hidden="true" />
          <div>
            <strong>{error}</strong>
            <span>Phiên Google chỉ dùng được trong thời gian ngắn. Nếu cần, bấm “Đổi tài khoản khác” để đăng nhập Google lại.</span>
          </div>
        </div>
      )}

      <div className="login-pending-actions">
        <button type="button" className="login-submit" onClick={() => void recheck()} disabled={checking}>
          {checking ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
          <span>{checking ? "Đang kiểm tra…" : "Làm mới trạng thái"}</span>
        </button>
        <button type="button" className="login-ghost" onClick={onSwitchAccount} disabled={checking}>
          <UserRoundCog size={18} aria-hidden="true" />
          <span>Đổi tài khoản khác</span>
        </button>
      </div>
    </section>
  );
}
