import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Construction,
  Cpu,
  Radio,
  ScanLine,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useLocation } from "react-router-dom";

const modules = {
  "/admin/orders": {
    eyebrow: "TRANSACTION CONTROL",
    title: "Order Management",
    description: "Monitor reservations, payment states, issued tickets, and order history from the transaction room.",
    icon: ClipboardCheck,
    metrics: [["Pending orders", "00"], ["Paid today", "00"], ["Expired holds", "00"]],
  },
  "/admin/staff": {
    eyebrow: "ROBOTICS OPERATIONS",
    title: "Staff Management",
    description: "Manage gate personnel, event assignments, access roles, and operational readiness.",
    icon: Users,
    metrics: [["Active staff", "00"], ["Assigned", "00"], ["On duty", "00"]],
  },
  "/admin/checkins": {
    eyebrow: "SECURITY GATEWAY",
    title: "Check-in Logs",
    description: "Inspect every scan result, duplicate attempt, rejected code, and successful event admission.",
    icon: ScanLine,
    metrics: [["Successful", "00"], ["Rejected", "00"], ["Duplicate", "00"]],
  },
  "/admin/reports": {
    eyebrow: "ANALYTICS OBSERVATORY",
    title: "Reports and Analytics",
    description: "Transform attendance, revenue, inventory, and gate activity into operational insights.",
    icon: BarChart3,
    metrics: [["Attendance", "0%"], ["Revenue", "0 ₫"], ["Live events", "00"]],
  },
} as const;

export function AdminPlaceholderPage() {
  const { pathname } = useLocation();
  const module = modules[pathname as keyof typeof modules] ?? modules["/admin/orders"];
  const Icon = module.icon;

  return (
    <section className="factory-module-page">
      <header className="factory-module-hero">
        <div>
          <div className="admin-live-label"><Radio size={13} /> {module.eyebrow}</div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
        <div className="factory-module-core"><Icon size={31} /></div>
      </header>

      <div className="factory-module-metrics">
        {module.metrics.map(([label, value], index) => (
          <article key={label}>
            {index === 0 ? <Activity size={17} /> : index === 1 ? <CheckCircle2 size={17} /> : <ShieldCheck size={17} />}
            <span>{label}</span><strong>{value}</strong>
          </article>
        ))}
      </div>

      <article className="factory-module-console">
        <div className="factory-console-visual"><Cpu size={42} /><i /><i /><i /></div>
        <div>
          <span><Construction size={13} /> BUSINESS MODULE STANDBY</span>
          <h3>Factory bay connected</h3>
          <p>The interface, routing, responsive layout, and background transition are ready. Connect this console to the module API when its business workflow is implemented.</p>
        </div>
      </article>
    </section>
  );
}
