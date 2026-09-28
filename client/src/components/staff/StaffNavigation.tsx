import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ScanLine, Calendar, History } from 'lucide-react';

export function StaffNavigation() {
  const tabs = [
    { to: '/staff', label: 'Tổng quan', icon: LayoutDashboard, end: true },
    { to: '/staff/check-in', label: 'Soát vé', icon: ScanLine, end: false },
    { to: '/staff/events', label: 'Sự kiện', icon: Calendar, end: false },
    { to: '/staff/history', label: 'Lịch sử', icon: History, end: false },
  ];

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-cyan-500/20 pb-3" aria-label="Điều hướng nhân viên">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex min-h-[44px] items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.4)]'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`
            }
          >
            <Icon size={18} />
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
