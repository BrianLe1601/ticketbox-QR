import { ArrowLeft, ArrowRight, ShieldCheck, Ticket } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import ticketboxLogoDark from "@/assets/brand/ticketbox-logo-dark.svg";
import ticketboxLogoLight from "@/assets/brand/ticketbox-logo-light.svg";
import { RouteProgress } from "@/components/shared/RouteProgress";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import type { ThemeMode } from "@/lib/ticketbox-theme";
import "@/styles/auth/login.css";

/**
 * The internal-gate "ticket" shared by /login and /reset-password: top bar, ticket stub with the
 * title, perforation, the page's own content, the access note and the separate strip for guests.
 */
export function AuthShell({
  theme,
  onToggleTheme,
  title,
  subtitle,
  children,
}: {
  theme: ThemeMode;
  onToggleTheme: () => void;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  // index.html may have painted a stored dark background before React; the page owns it now.
  useEffect(() => { delete document.documentElement.dataset.tbBoot; }, []);
  return (
    <main className="login-page" data-theme={theme}>
      <RouteProgress />
      <header className="login-top">
        <div className="login-top-brand">
          <button className="login-brand" type="button" onClick={() => navigate("/")} aria-label="Về trang chủ TicketBox QR">
            <img src={theme === "dark" ? ticketboxLogoDark : ticketboxLogoLight} alt="TicketBox" />
          </button>
          <span className="login-gate-badge">Cổng nội bộ</span>
        </div>
        <div className="login-top-actions">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <Link to="/" className="login-home-link"><ArrowLeft size={16} aria-hidden="true" /><span>Về trang chủ</span></Link>
        </div>
      </header>

      <section className="login-shell" aria-labelledby="login-title">
        <div className="login-card">
          <header className="login-card-header">
            <span className="login-eyebrow"><span className="login-eyebrow-dot" aria-hidden="true" />Vận hành concert & soát vé</span>
            <h1 id="login-title">{title}</h1>
            <p>{subtitle}</p>
          </header>

          {children}

          <footer className="login-card-footer">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Quyền truy cập do máy chủ quyết định theo tài khoản và phê duyệt của Quản trị viên.</span>
          </footer>
        </div>

        <aside className="login-guest" aria-label="Dành cho khách mua vé">
          <Ticket size={18} aria-hidden="true" />
          <span><strong>Khách mua vé không cần đăng nhập</strong> — chỉ cần xác thực email khi đặt vé.</span>
          <Link to="/events" className="login-guest-link">Về trang mua vé<ArrowRight size={16} aria-hidden="true" /></Link>
        </aside>
      </section>
    </main>
  );
}
