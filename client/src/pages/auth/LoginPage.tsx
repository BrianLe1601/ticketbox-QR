import { Bot, CircuitBoard, ShieldCheck, Ticket, Wifi } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";

import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/context/AuthContext";

export function LoginPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  if (!isLoading && user) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/staff"} replace />;
  }

  return (
    <main className="tech-login-page">
      <div className="tech-grid" />
      <div className="tech-circuit-layer tech-circuit-login" aria-hidden="true">
        <i className="circuit-node node-one" />
        <i className="circuit-node node-two" />
        <i className="circuit-node node-three" />
        <i className="circuit-pulse pulse-one" />
        <i className="circuit-pulse pulse-two" />
      </div>
      <div className="tech-orb tech-orb-one" />
      <div className="tech-orb tech-orb-two" />

      <button className="tech-brand" type="button" onClick={() => navigate("/")}>
        <span><Ticket size={18} /></span>
        TicketBox QR
      </button>

      <section className="tech-login-stage">
        <div className="tech-login-copy">
          <div className="tech-system-pill"><Wifi size={14} /> SYSTEM ONLINE</div>
          <h1>Event command center.</h1>
          <p>
            Manage tickets, monitor check-ins, and track event activity from one unified operations center.
          </p>
          <div className="tech-robot-visual" aria-hidden="true">
            <div className="tech-robot-ring tech-ring-one" />
            <div className="tech-robot-ring tech-ring-two" />
            <div className="tech-robot-head"><Bot size={54} /></div>
            <span className="tech-scan-line" />
          </div>
        </div>

        <div className="tech-login-panel">
          <div className="tech-panel-line" />
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="tech-overline">SECURE ACCESS</p>
              <h2>Welcome back</h2>
              <p className="mt-2 text-sm text-slate-400">Authorized access for administrators and staff.</p>
            </div>
            <div className="tech-panel-icon"><CircuitBoard size={23} /></div>
          </div>
          <LoginForm />
          <div className="tech-secure-note"><ShieldCheck size={15} /> Connection secured with JWT</div>
        </div>
      </section>
    </main>
  );
}
