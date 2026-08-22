import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  ChevronLeft,
  ClipboardCheck,
  LogOut,
  Menu,
  ScanLine,
  Settings,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";

const navigation = [
  { label: "Overview", to: "/admin", icon: Activity, end: true },
  { label: "Events", to: "/admin/events", icon: CalendarDays },
  { label: "Ticket Types", to: "/admin/ticket-types", icon: Ticket },
  { label: "Orders", to: "/admin/orders", icon: ClipboardCheck },
  { label: "Staff", to: "/admin/staff", icon: Users },
  { label: "Check-in logs", to: "/admin/checkins", icon: ScanLine },
  { label: "Reports", to: "/admin/reports", icon: BarChart3 },
];

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const currentLabel = navigation.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  )?.label ?? "Admin Command Center";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="admin-room">
      <div className="admin-room-grid" />
      <div className="tech-circuit-layer tech-circuit-admin" aria-hidden="true">
        <i className="circuit-node node-one" />
        <i className="circuit-node node-two" />
        <i className="circuit-node node-three" />
        <i className="circuit-pulse pulse-one" />
        <i className="circuit-pulse pulse-two" />
      </div>
      {sidebarOpen && <button className="admin-backdrop" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}

      <aside className={`admin-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="admin-sidebar-brand">
          <div className="admin-brand-core"><Bot size={23} /></div>
          <div><strong>TICKETBOX</strong><span>CONTROL OS</span></div>
          <button className="admin-mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"><X size={20} /></button>
        </div>

        <div className="admin-status-chip"><span /> ROBOT CORE ONLINE</div>

        <nav className="admin-nav" aria-label="Admin navigation">
          {navigation.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `admin-nav-link ${isActive ? "is-active" : ""}`}
            >
              <Icon size={18} />
              <span>{label}</span>
              <ChevronLeft className="admin-nav-arrow" size={14} />
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <button className="admin-nav-link" type="button"><Settings size={18} /><span>Settings</span></button>
          <button className="admin-nav-link danger" type="button" onClick={handleLogout}><LogOut size={18} /><span>Sign out</span></button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="flex items-center gap-3">
            <button className="admin-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><Menu size={20} /></button>
            <div><p className="admin-breadcrumb">COMMAND ROOM / {currentLabel.toUpperCase()}</p><h1>{currentLabel}</h1></div>
          </div>
          <div className="admin-top-actions">
            <button className="admin-icon-button" aria-label="Notifications"><Bell size={18} /><span /></button>
            <div className="admin-user-chip">
              <div className="admin-avatar">{user?.fullName.charAt(0).toUpperCase()}</div>
              <div><strong>{user?.fullName}</strong><span>{user?.role === "admin" ? "Administrator" : "Staff"}</span></div>
            </div>
          </div>
        </header>

        <main className="admin-content"><Outlet /></main>
      </div>
    </div>
  );
}
