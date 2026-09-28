import { Link, Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { StaffNavigation } from '@/components/staff/StaffNavigation';
import ticketboxLogoDark from '@/assets/brand/ticketbox-logo-dark.svg';
import ticketboxMascot from '@/assets/brand/ticketbox-mascot.svg';

export function StaffLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="staff-tech-room min-h-screen bg-[#07111f] text-slate-100">
      <div className="staff-tech-grid" aria-hidden="true" />
      <div className="tech-circuit-layer tech-circuit-staff" aria-hidden="true">
        <i className="circuit-node node-one" />
        <i className="circuit-node node-two" />
        <i className="circuit-node node-three" />
        <i className="circuit-pulse pulse-one" />
        <i className="circuit-pulse pulse-two" />
      </div>
      <header className="relative z-[5] border-b border-cyan-500/20 bg-slate-900/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3.5">
            <Link
              to="/staff"
              className="flex items-center shrink-0 transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-cyan-400 rounded-lg"
              aria-label="Trang chủ nhân viên TicketBox"
            >
              <img className="h-11 w-11 object-contain drop-shadow-[0_2px_10px_rgba(34,211,238,0.35)] sm:hidden" src={ticketboxMascot} alt="TicketBox" />
              <img className="hidden h-11 sm:h-12 w-auto max-w-[195px] object-contain object-left drop-shadow-[0_2px_14px_rgba(34,211,238,0.3)] sm:block" src={ticketboxLogoDark} alt="TicketBox" />
            </Link>
            <span className="hidden h-6 w-px bg-white/15 sm:block" aria-hidden="true" />
            <span className="inline-flex items-center rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
              Khu vực Nhân viên
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <span className="block text-xs font-bold text-slate-200">{user?.fullName}</span>
              <span className="block text-[11px] text-cyan-400 uppercase tracking-wider">Nhân viên soát vé</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-rose-500/30 px-3 text-xs font-semibold text-rose-300 hover:bg-rose-500/10"
              aria-label="Đăng xuất"
            >
              <LogOut size={14} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-[2] mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <StaffNavigation />
        <Outlet />
      </main>
    </div>
  );
}
