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
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import analyticsRoom from "@/assets/backgrounds/admin-analytics-room.webp";
import commandRoom from "@/assets/backgrounds/admin-command-room.webp";
import staffOperationsRoom from "@/assets/backgrounds/admin-staff-operations.webp";
import ticketVault from "@/assets/backgrounds/admin-ticket-vault.webp";
import transactionRoom from "@/assets/backgrounds/admin-transaction-room.webp";
import eventHall from "@/assets/backgrounds/login-gate-inside.webp";
import checkinGateway from "@/assets/backgrounds/staff-event-entry.webp";

const navigation = [
  { label: "Overview", to: "/admin", icon: Activity, end: true },
  { label: "Events", to: "/admin/events", icon: CalendarDays },
  { label: "Ticket Types", to: "/admin/ticket-types", icon: Ticket },
  { label: "Orders", to: "/admin/orders", icon: ClipboardCheck },
  { label: "Staff", to: "/admin/staff", icon: Users },
  { label: "Check-in logs", to: "/admin/checkins", icon: ScanLine },
  { label: "Reports", to: "/admin/reports", icon: BarChart3 },
];

const factoryRooms = {
  command: { image: eventHall, position: "center", accent: "cyan" },
  events: { image: commandRoom, position: "center", accent: "blue" },
  tickets: { image: ticketVault, position: "center", accent: "violet" },
  transactions: { image: transactionRoom, position: "center", accent: "red" },
  operations: { image: staffOperationsRoom, position: "center", accent: "cyan" },
  gateway: { image: checkinGateway, position: "center", accent: "blue" },
  analytics: { image: analyticsRoom, position: "center", accent: "red" },
} as const;

function roomForPath(pathname: string): keyof typeof factoryRooms {
  if (pathname.startsWith("/admin/events")) return "events";
  if (pathname.startsWith("/admin/ticket-types")) return "tickets";
  if (pathname.startsWith("/admin/orders")) return "transactions";
  if (pathname.startsWith("/admin/staff")) return "operations";
  if (pathname.startsWith("/admin/checkins")) return "gateway";
  if (pathname.startsWith("/admin/reports")) return "analytics";
  return "command";
}

function doorForRoom(room: keyof typeof factoryRooms): "image" | "classic" {
  return ["command", "events", "tickets"].includes(room) ? "image" : "classic";
}

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState<"idle" | "leaving" | "entering">("entering");
  const [pendingRoom, setPendingRoom] = useState<keyof typeof factoryRooms | null>(null);
  const leaveTimer = useRef<number | null>(null);
  const enterTimer = useRef<number | null>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeRoom = roomForPath(location.pathname);
  const airlockDoor = doorForRoom(pendingRoom ?? activeRoom);

  const currentLabel = navigation.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  )?.label ?? "Admin Command Center";

  useEffect(() => {
    enterTimer.current = window.setTimeout(() => setTransitionPhase("idle"), 900);
    return () => {
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
      if (enterTimer.current) window.clearTimeout(enterTimer.current);
    };
  }, []);

  useEffect(() => {
    const preload = () => Object.values(factoryRooms).forEach(({ image: source }) => {
      const image = new Image(); image.decoding = "async"; image.src = source;
    });
    const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void) => number; cancelIdleCallback?: (id: number) => void };
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(preload);
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(preload, 500);
    return () => window.clearTimeout(id);
  }, []);

  function handleNavigation(event: MouseEvent<HTMLAnchorElement>, to: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (location.pathname === to || transitionPhase !== "idle") {
      event.preventDefault();
      setSidebarOpen(false);
      return;
    }

    event.preventDefault();
    setSidebarOpen(false);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      navigate(to);
      return;
    }

    setPendingRoom(roomForPath(to));
    setTransitionPhase("leaving");
    leaveTimer.current = window.setTimeout(() => {
      navigate(to);
      setTransitionPhase("entering");
      enterTimer.current = window.setTimeout(() => { setTransitionPhase("idle"); setPendingRoom(null); }, 900);
    }, 620);
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className={`admin-room admin-route-${transitionPhase}`} data-room={activeRoom} aria-busy={transitionPhase !== "idle"}>
      <div className="admin-room-background admin-room-background-current" style={{ backgroundImage: `url(${factoryRooms[activeRoom].image})`, backgroundPosition: factoryRooms[activeRoom].position }} aria-hidden="true" />
      {pendingRoom && <div className="admin-room-background admin-room-background-next" style={{ backgroundImage: `url(${factoryRooms[pendingRoom].image})`, backgroundPosition: factoryRooms[pendingRoom].position }} aria-hidden="true" />}
      <div className="admin-airlock" data-variant={airlockDoor} aria-hidden="true">
        <div className="admin-airlock-door admin-airlock-left"><i /></div>
        <div className="admin-airlock-door admin-airlock-right"><i /></div>
        <span className="admin-airlock-core" />
      </div>
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
              onClick={(event) => handleNavigation(event, to)}
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

        <main className="admin-content"><div className="admin-route-stage" key={location.pathname}><Outlet /></div></main>
      </div>
      <div className="admin-route-transition-line" aria-hidden="true" />
    </div>
  );
}
