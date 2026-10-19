import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ScanLine, CalendarDays, History } from 'lucide-react';

/**
 * Four Staff sections in one segmented pill bar; below 768px it is pinned to the bottom of the screen
 * for one-handed use. "Soát vé" carries a dot (and words for screen readers) while a gate is open.
 */
export function StaffNavigation({ openGates }: { openGates: number }) {
  const tabs = [
    { to: '/staff', label: 'Tổng quan', icon: LayoutDashboard, end: true },
    { to: '/staff/check-in', label: 'Soát vé', icon: ScanLine, end: false, live: openGates > 0 },
    { to: '/staff/events', label: 'Sự kiện', icon: CalendarDays, end: false },
    { to: '/staff/history', label: 'Lịch sử', icon: History, end: false },
  ];

  return (
    <nav className="sp-nav" aria-label="Điều hướng nhân viên">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => `sp-nav-tab${isActive ? ' is-active' : ''}`}>
            <span className="sp-nav-icon">
              <Icon size={20} aria-hidden="true" />
              {tab.live && <span className="sp-nav-live" aria-hidden="true" />}
            </span>
            <span className="sp-nav-label">{tab.label}</span>
            {tab.live && <span className="sr-only"> — có {openGates} cổng đang mở</span>}
          </NavLink>
        );
      })}
    </nav>
  );
}
