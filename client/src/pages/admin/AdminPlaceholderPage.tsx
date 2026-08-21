import { Construction, Cpu } from "lucide-react";
import { useLocation } from "react-router-dom";

const titles: Record<string, string> = {
  "/admin/events": "Event Management",
  "/admin/ticket-types": "Ticket Type Management",
  "/admin/orders": "Order Management",
  "/admin/staff": "Staff Management",
  "/admin/checkins": "Check-in History",
  "/admin/reports": "Reports and Analytics",
};

export function AdminPlaceholderPage() {
  const { pathname } = useLocation();
  const title = titles[pathname] ?? "Admin Module";

  return (
    <section className="admin-command-panel grid min-h-[420px] place-content-center text-center">
      <div className="mx-auto mb-5 grid size-20 place-items-center rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-300">
        <Cpu size={34} />
      </div>
      <div className="admin-live-label mx-auto mb-4"><Construction size={13} /> MODULE STANDBY</div>
      <h2 className="text-2xl font-bold text-slate-100">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">
        Navigation is ready. Business features for this module will be implemented in the upcoming development phases.
      </p>
    </section>
  );
}
