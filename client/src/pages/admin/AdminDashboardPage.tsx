import {
  Activity,
  Bot,
  CalendarDays,
  CheckCircle2,
  Radio,
  Ticket,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";

const stats = [
  { label: "Active Events", value: "00", detail: "No data available", icon: CalendarDays, tone: "cyan" },
  { label: "Issued Tickets", value: "00", detail: "Real-time synchronization", icon: Ticket, tone: "violet" },
  { label: "Check-ins", value: "00", detail: "Today", icon: CheckCircle2, tone: "green" },
  { label: "On-duty Staff", value: "00", detail: "Currently assigned", icon: Users, tone: "amber" },
];

export function AdminDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="admin-dashboard">
      <section className="admin-welcome">
        <div>
          <div className="admin-live-label"><Radio size={13} /> LIVE CONTROL</div>
          <h2>Welcome, {user?.fullName}</h2>
          <p>The command center is ready. Modules will come online as event data is connected.</p>
        </div>
        <div className="admin-clock"><span>SYS.TIME</span><strong>{new Date().toLocaleDateString("en-GB")}</strong></div>
      </section>

      <section className="admin-stat-grid">
        {stats.map(({ label, value, detail, icon: Icon, tone }) => (
          <article className={`admin-stat-card ${tone}`} key={label}>
            <div className="admin-stat-icon"><Icon size={21} /></div>
            <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
            <TrendingUp className="admin-stat-signal" size={18} />
          </article>
        ))}
      </section>

      <section className="admin-panel-grid">
        <article className="admin-command-panel">
          <div className="admin-panel-heading"><div><span>ROBOT OPERATIONS</span><h3>System Status</h3></div><Activity size={20} /></div>
          <div className="admin-robot-console">
            <div className="admin-radar"><span className="admin-radar-sweep" /><div className="admin-robot-core"><Bot size={48} /></div></div>
            <div className="admin-system-list">
              {["API Gateway", "MySQL Database", "QR Security", "Email Service"].map((item, index) => (
                <div key={item}><span><i className={index < 3 ? "online" : "standby"} />{item}</span><strong>{index < 3 ? "ONLINE" : "STANDBY"}</strong></div>
              ))}
            </div>
          </div>
        </article>

        <article className="admin-command-panel">
          <div className="admin-panel-heading"><div><span>QUICK COMMANDS</span><h3>Quick Actions</h3></div><Zap size={20} /></div>
          <div className="admin-quick-grid">
            <button><CalendarDays size={20} /><span>Create Event</span><small>Set up a new event</small></button>
            <button><Ticket size={20} /><span>Create Ticket Type</span><small>Configure price and capacity</small></button>
            <button><Users size={20} /><span>Assign Staff</span><small>Set up gate personnel</small></button>
            <button><Activity size={20} /><span>View Reports</span><small>Monitor event activity</small></button>
          </div>
        </article>
      </section>
    </div>
  );
}
