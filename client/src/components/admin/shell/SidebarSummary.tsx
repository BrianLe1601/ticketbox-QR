import type { AdminSignals } from "@/hooks/useAdminSignals";
import { formatNumber } from "@/lib/admin-format";

/** Quick operational summary in the sidebar (replaces the template's "Message" box). Real API counts only. */
export function SidebarSummary({ signals }: { signals: AdminSignals }) {
  const summary = signals.summary;
  const rows: Array<[string, number | undefined]> = [
    ["Sự kiện hoạt động", summary?.events.active],
    ["Vé chưa check-in", summary?.tickets.issued],
    ["Đơn chờ thanh toán", summary?.orders.pending],
    ["Nhân viên chờ duyệt", summary?.staff.pendingApproval],
  ];
  return (
    <section className="adm-shell-summary" aria-label="Tóm tắt nhanh">
      <h2 className="adm-shell-summary-title">
        Tóm tắt nhanh
        {signals.openGates.length > 0 && <span className="adm-shell-summary-live">Live</span>}
      </h2>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt><span aria-hidden="true" className="adm-shell-summary-dot" />{label}</dt>
            <dd className="tb-num">{summary ? formatNumber(value) : "…"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
