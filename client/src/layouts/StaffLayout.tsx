import { LogOut, ScanLine } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function StaffLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
      <header className="flex h-16 items-center justify-between border-b border-cyan-400/15 bg-[#081727]/90 px-5 backdrop-blur-xl">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-cyan-400/15 p-2 text-cyan-300"><ScanLine size={20} /></span><div><strong>TicketBox Scanner</strong><p className="text-xs text-slate-500">Staff Operations</p></div></div>
        <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-white" onClick={() => { logout(); navigate("/login", { replace: true }); }}><LogOut size={17} />Sign out</button>
      </header>
      <main className="relative z-[2] mx-auto max-w-6xl p-5"><p className="mb-5 text-sm text-slate-400">Staff member: {user?.fullName}</p><Outlet /></main>
    </div>
  );
}
