import { Suspense, useEffect, useLayoutEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { RouteProgress } from '@/components/shared/RouteProgress';
import { ConnectionPill } from '@/components/staff/ConnectionPill';
import { StaffNavigation } from '@/components/staff/StaffNavigation';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { usePreloadPages } from '@/hooks/usePreloadPages';
import { useStaffShellData } from '@/hooks/useStaffShell';
import { initialsOf } from '@/lib/staff-portal';
import { useTheme } from '@/lib/ticketbox-theme';
import { staffPageLoaders } from '@/routes/page-loaders';
import ticketboxLogoLight from '@/assets/brand/ticketbox-logo-light.svg';
import ticketboxLogoDark from '@/assets/brand/ticketbox-logo-dark.svg';
import ticketboxMascot from '@/assets/brand/ticketbox-mascot.svg';
import '@/styles/staff/theme.css';
import '@/styles/staff/portal.css';

export function StaffLayout() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme('staff', user?.id ?? 0);
  const shell = useStaffShellData(token);
  const openGates = shell.overview?.counts.open ?? 0;
  // Section switches must not leave the previous page on screen while a chunk downloads.
  usePreloadPages(staffPageLoaders);

  // Dialogs render into <body>; mark it so they inherit the Staff tokens, and clean up on exit.
  useEffect(() => {
    document.body.dataset.staffAppearance = theme;
    // index.html painted an early dark background (no light flash); the portal owns it now.
    delete document.documentElement.dataset.tbBoot;
    return () => { delete document.body.dataset.staffAppearance; };
  }, [theme]);

  // Each section opens at its top; query-string changes (filters, selected Event) keep the position.
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="staff-portal-room" data-theme={theme}>
      <RouteProgress />
      <header className="sp-header">
        <div className="sp-header-brand">
          <Link to="/staff" className="sp-brand" aria-label="Trang chủ nhân viên TicketBox">
            <img className="sp-brand-mascot" src={ticketboxMascot} alt="TicketBox" />
            <img className="sp-brand-logo" src={theme === 'dark' ? ticketboxLogoDark : ticketboxLogoLight} alt="TicketBox" />
          </Link>
          <span className="sp-divider" aria-hidden="true" />
          <span className="sp-badge"><span className="sp-dot" aria-hidden="true" />Soát vé / Cổng</span>
          <ConnectionPill online={shell.online} lastSyncAt={shell.lastSyncAt} failing={Boolean(shell.error)} />
        </div>

        <div className="sp-header-actions">
          <ThemeToggle theme={theme} onToggle={toggle} />
          <div className="sp-profile" title={user?.email}>
            <span className="sp-avatar" aria-hidden="true">{initialsOf(user?.fullName)}</span>
            <span className="sp-profile-text">
              <strong>{user?.fullName}</strong>
              <span>Nhân viên soát vé</span>
            </span>
          </div>
          <button type="button" onClick={handleLogout} className="sp-logout" aria-label="Đăng xuất khỏi hệ thống">
            <LogOut size={16} aria-hidden="true" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </header>

      <main className="sp-main">
        <StaffNavigation openGates={openGates} />
        {/* Page chunks load inside the shell, so the header and section bar never disappear. */}
        <Suspense fallback={<div className="sp-page sp-route-loading" role="status"><span className="sr-only">Đang tải trang</span><div className="sp-route-loading-block" aria-hidden="true" /></div>}>
          <Outlet context={shell} />
        </Suspense>
      </main>
    </div>
  );
}
