import { Lock, ShieldCheck, Ticket } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";

import loginBackground from "@/assets/backgrounds/login-gate-inside.webp";
import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/context/AuthContext";
import type { AuthUser } from "@/types/auth";

export function LoginPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  function handleLoginSuccess(authenticatedUser: AuthUser, requestedPath: string) {
    const destination = authenticatedUser.role === "admin"
      ? "/admin"
      : requestedPath.startsWith("/staff") ? requestedPath : "/staff";
    navigate(destination, { replace: true });
  }

  if (!isLoading && user) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/staff"} replace />;
  }

  return (
    <main className="simple-login" style={{ backgroundImage: `url(${loginBackground})` }}>
      <div className="simple-login-overlay" aria-hidden="true" />

      <button className="simple-login-brand" type="button" onClick={() => navigate("/")}>
        <span><Ticket size={20} /></span>
        <strong>TICKETBOX QR<small>OPERATIONS CENTER</small></strong>
      </button>

      <section className="simple-login-content" aria-labelledby="login-title">
        <div className="simple-login-copy">
          <span><ShieldCheck size={16} /> SECURE OPERATIONS</span>
          <h1>Quản lý sự kiện<br />nhanh và chính xác.</h1>
          <p>Đăng nhập để quản lý sự kiện, loại vé, đơn hàng và vận hành check-in trong một hệ thống thống nhất.</p>
        </div>

        <div className="simple-login-card">
          <header>
            <div>
              <p>ADMIN &amp; STAFF</p>
              <h2 id="login-title">Đăng nhập hệ thống</h2>
              <span>Sử dụng tài khoản được cấp để tiếp tục.</span>
            </div>
            <i><Lock size={22} /></i>
          </header>

          <LoginForm onLoginSuccess={handleLoginSuccess} />

          <footer><ShieldCheck size={13} /> Phiên đăng nhập được bảo vệ an toàn</footer>
        </div>
      </section>
    </main>
  );
}
