import {
  ArrowLeft,
  BarChart3,
  Lock,
  QrCode,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import loginBackground from "@/assets/backgrounds/login-gate-inside.webp";
import ticketboxLogoDark from "@/assets/brand/ticketbox-logo-dark.svg";
import { GoogleStaffLogin } from "@/components/auth/GoogleStaffLogin";
import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/context/AuthContext";
import type { AuthUser } from "@/types/auth";

export function LoginPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;

  function handleLoginSuccess(authenticatedUser: AuthUser, requestedPath: string) {
    const destination =
      authenticatedUser.role === "admin"
        ? "/admin"
        : requestedPath.startsWith("/staff")
        ? requestedPath
        : "/staff";
    navigate(destination, { replace: true });
  }

  if (!isLoading && user) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/staff"} replace />;
  }

  return (
    <main
      className="auth-portal-page"
      style={{ backgroundImage: `url(${loginBackground})` }}
    >
      <div className="auth-portal-overlay" aria-hidden="true" />

      {/* Top Navbar */}
      <header className="auth-portal-nav">
        <button
          className="auth-brand-btn"
          type="button"
          onClick={() => navigate("/")}
          aria-label="Về trang chủ TicketBox QR"
        >
          <img className="auth-brand-logo" src={ticketboxLogoDark} alt="TicketBox" />
        </button>

        <Link to="/" className="auth-home-btn">
          <ArrowLeft size={14} />
          <span>Về trang chủ</span>
        </Link>
      </header>

      {/* Main Grid Content */}
      <section className="auth-portal-main" aria-labelledby="login-title">
        {/* Left Column: Platform Showcase */}
        <div className="auth-hero-pane">
          <div className="auth-status-badge">
            <span className="auth-status-dot" />
            <span>SYSTEM OPERATIONAL · GATEWAY 2026</span>
          </div>

          <h1 className="auth-hero-title">
            Nền tảng Quản lý &amp;<br />
            <span>Vận hành Sự kiện</span>
          </h1>

          <p className="auth-hero-desc">
            Trung tâm điều phối toàn diện: bán vé, phát hành mã QR cá nhân hóa, quản trị nhân sự
            và kiểm soát cổng check-in thời gian thực với độ tin cậy tuyệt đối.
          </p>

          <div className="auth-features-list">
            <div className="auth-feature-card">
              <div className="auth-feature-icon">
                <QrCode size={18} />
              </div>
              <div className="auth-feature-text">
                <strong>Xác thực vé siêu tốc (&lt; 100ms)</strong>
                <p>Quét mã QR bảo mật cao, phòng chống vé giả mạo và vé quét trùng lặp tuyệt đối.</p>
              </div>
            </div>

            <div className="auth-feature-card">
              <div className="auth-feature-icon">
                <Users size={18} />
              </div>
              <div className="auth-feature-text">
                <strong>Quản trị nhân sự &amp; Phân công ca trực</strong>
                <p>Tách biệt quyền hạn Admin và Staff, chống trùng lặp lịch trực giữa các sự kiện.</p>
              </div>
            </div>

            <div className="auth-feature-card">
              <div className="auth-feature-icon">
                <BarChart3 size={18} />
              </div>
              <div className="auth-feature-text">
                <strong>Kiểm soát doanh thu &amp; Lượng khách</strong>
                <p>Cập nhật số lượng vé đã bán, vé đang giữ chỗ và tiến độ vào cổng theo thời gian thực.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Modern Glass Login Card */}
        <div className="auth-card-pane">
          <div className="auth-login-card">
            <header className="auth-card-header">
              <div className="flex items-center justify-between">
                <span className="auth-portal-pill">
                  <Sparkles size={11} className="mr-1 inline text-cyan-400" />
                  GATEWAY ACCESS
                </span>
                <span className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2 text-cyan-400">
                  <Lock size={18} />
                </span>
              </div>
              <h2 id="login-title">Đăng nhập hệ thống</h2>
              <p>Dành cho Quản trị viên (Admin) và Nhân viên soát vé (Staff)</p>
            </header>

            {/* Email & Password Login Form */}
            {notice && <p className="auth-session-notice" role="status">{notice}</p>}
            <LoginForm onLoginSuccess={handleLoginSuccess} />

            {/* Google Identity Services for Staff */}
            <GoogleStaffLogin onLoginSuccess={handleLoginSuccess} />

            <footer className="auth-card-footer">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>JWT ngắn hạn kết hợp phiên làm mới HttpOnly có thể thu hồi</span>
            </footer>
          </div>
        </div>
      </section>
    </main>
  );
}
