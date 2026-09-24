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
  Tags,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import adminBackground from "@/assets/backgrounds/admin-command-room.webp";
import { useAuth } from "@/context/AuthContext";

const navigation = [
  { label: "Tổng quan", to: "/admin", icon: Activity, end: true },
  { label: "Sự kiện", to: "/admin/events", icon: CalendarDays },
  { label: "Hạng vé", to: "/admin/ticket-types", icon: Ticket },
  { label: "Danh mục", to: "/admin/categories", icon: Tags },
  { label: "Đơn hàng", to: "/admin/orders", icon: ClipboardCheck },
  { label: "Nhân viên", to: "/admin/staff", icon: Users },
  { label: "Nhật ký check-in", to: "/admin/checkins", icon: ScanLine },
  { label: "Báo cáo", to: "/admin/reports", icon: BarChart3 },
];

function sectionForPath(pathname: string) {
  if (pathname.startsWith("/admin/events")) return "events";
  if (pathname.startsWith("/admin/ticket-types")) return "tickets";
  if (pathname.startsWith("/admin/categories")) return "tickets";
  if (pathname.startsWith("/admin/orders")) return "transactions";
  if (pathname.startsWith("/admin/staff")) return "operations";
  if (pathname.startsWith("/admin/checkins")) return "gateway";
  if (pathname.startsWith("/admin/reports")) return "analytics";
  return "command";
}

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeSection = sectionForPath(location.pathname);

  const currentLabel = navigation.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  )?.label ?? "Trung tâm quản trị";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="admin-room admin-room-simple" data-room={activeSection}>
      <div className="admin-room-background admin-room-background-current" style={{ backgroundImage: `url(${adminBackground})` }} aria-hidden="true" />
      {sidebarOpen && <button className="admin-backdrop" aria-label="Đóng menu" onClick={() => setSidebarOpen(false)} />}

      <aside className={`admin-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="admin-sidebar-brand">
          <div className="admin-brand-core"><Bot size={23} /></div>
          <div><strong>TICKETBOX</strong><span>TRUNG TÂM ĐIỀU HÀNH</span></div>
          <button className="admin-mobile-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Đóng thanh điều hướng"><X size={20} /></button>
        </div>

        <div className="admin-status-chip"><span /> HỆ THỐNG ĐANG HOẠT ĐỘNG</div>

        <nav className="admin-nav" aria-label="Điều hướng quản trị">
          {navigation.map(({ label, to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `admin-nav-link ${isActive ? "is-active" : ""}`}>
              <Icon size={18} />
              <span>{label}</span>
              <ChevronLeft className="admin-nav-arrow" size={14} />
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <button className="admin-nav-link" type="button"><Settings size={18} /><span>Cài đặt</span></button>
          <button className="admin-nav-link danger" type="button" onClick={handleLogout}><LogOut size={18} /><span>Đăng xuất</span></button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="flex items-center gap-3">
            <button className="admin-menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="Mở thanh điều hướng"><Menu size={20} /></button>
            <div><p className="admin-breadcrumb">QUẢN TRỊ / {currentLabel.toUpperCase()}</p><h1>{currentLabel}</h1></div>
          </div>
          <div className="admin-top-actions">
            <button className="admin-icon-button" type="button" aria-label="Thông báo"><Bell size={18} /><span /></button>
            <div className="admin-user-chip">
              <div className="admin-avatar">{user?.fullName.charAt(0).toUpperCase()}</div>
              <div><strong>{user?.fullName}</strong><span>{user?.role === "admin" ? "Quản trị viên" : "Nhân viên"}</span></div>
            </div>
          </div>
        </header>

        <main className="admin-content"><div className="admin-route-stage"><Outlet /></div></main>
      </div>
    </div>
  );
}
