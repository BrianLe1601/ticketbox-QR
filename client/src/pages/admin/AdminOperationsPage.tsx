import {
  AlertTriangle, BarChart3, CheckCircle2, Clock3, Download, Filter, RefreshCw,
  ScanLine, ShieldAlert, TicketCheck, Users, WalletCards, XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { useAuth } from "@/context/AuthContext";
import { digitsOnly } from "@/lib/utils";
import {
  exportOperations, loadAdminLogs, loadReport, searchReportEvents,
  type AdminCheckinLog, type CheckinLogStats, type EventReport,
  type OperationFilters, type ReportEvent,
} from "@/services/report.service";

const emptyStats: CheckinLogStats = { total: 0, success: 0, rejected: 0, duplicate: 0, invalid: 0 };
const resultLabels: Record<string, string> = {
  SUCCESS: "Vào cổng thành công", FAILED: "Tất cả lượt bị từ chối",
  ALREADY_CHECKED_IN: "Vé đã được sử dụng", WRONG_EVENT: "Vé thuộc sự kiện khác",
  CANCELLED: "Vé đã bị hủy", UNPAID: "Đơn chưa thanh toán",
  INVALID: "Mã giả hoặc không hợp lệ", EVENT_NOT_AVAILABLE: "Ngoài thời gian check-in",
  STAFF_NOT_ASSIGNED: "Nhân viên chưa được phân công",
};
const resultOptions = [
  "SUCCESS", "FAILED", "ALREADY_CHECKED_IN", "WRONG_EVENT", "CANCELLED",
  "UNPAID", "INVALID", "EVENT_NOT_AVAILABLE", "STAFF_NOT_ASSIGNED",
];

const formatNumber = (value: number) => Number(value).toLocaleString("vi-VN");
const formatMoney = (value: number) => new Intl.NumberFormat("vi-VN", {
  style: "currency", currency: "VND", maximumFractionDigits: 0,
}).format(Number(value));
const formatTime = (value: string) => new Date(value).toLocaleString("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
});
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : "Không thể kết nối máy chủ.";
const statusTone = (result: string) => result === "SUCCESS" ? "success" : result === "ALREADY_CHECKED_IN" ? "warning" : "danger";

function FilterPanel({
  kind, filters, events, search, searchLoading, eventError, loading, onSearch,
  onChange, onSubmit, onRetry,
}: {
  kind: "reports" | "checkins"; filters: OperationFilters; events: ReportEvent[];
  search: string; searchLoading: boolean; eventError: string; loading: boolean;
  onSearch: (value: string) => void;
  onChange: (key: keyof OperationFilters, value: string) => void;
  onSubmit: () => void; onRetry: () => void;
}) {
  const rangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);
  return <form className="operations-filter-panel" onSubmit={(event) => { event.preventDefault(); if (!rangeInvalid) onSubmit(); }}>
    <div className="operations-panel-title"><Filter size={16}/><div><strong>Bộ lọc dữ liệu</strong><span>Khoảng ngày được tính theo giờ Việt Nam</span></div></div>
    <div className="operations-filter-grid">
      <label><span>Tìm sự kiện</span><input value={search} maxLength={100} onChange={(event) => onSearch(event.target.value)} placeholder="Nhập tên sự kiện..."/></label>
      <label><span>Sự kiện cần xem</span><select required value={filters.eventId} onChange={(event) => onChange("eventId", event.target.value)}><option value="">Chọn sự kiện</option>{events.map((event) => <option value={event.id} key={event.id}>{event.name}</option>)}</select></label>
      <label><span>Từ ngày</span><input type="date" value={filters.from} onChange={(event) => onChange("from", event.target.value)}/></label>
      <label><span>Đến hết ngày</span><input type="date" value={filters.to} onChange={(event) => onChange("to", event.target.value)}/></label>
      {kind === "reports" ? <label><span>Nhóm biểu đồ theo</span><select value={filters.groupBy ?? "day"} onChange={(event) => onChange("groupBy", event.target.value)}><option value="day">Ngày</option><option value="month">Tháng</option><option value="year">Năm</option></select></label> : <>
        <label><span>Mã nhân viên (tùy chọn)</span><input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={10} value={filters.staffId ?? ""} onChange={(event) => onChange("staffId", digitsOnly(event.target.value, 10))} placeholder="Ví dụ: 12"/></label>
        <label><span>Kết quả quét</span><select value={filters.result ?? ""} onChange={(event) => onChange("result", event.target.value)}><option value="">Tất cả kết quả</option>{resultOptions.map((result) => <option key={result} value={result}>{resultLabels[result]}</option>)}</select></label>
      </>}
    </div>
    {searchLoading && <p className="operations-inline-note" role="status">Đang tìm sự kiện…</p>}
    {eventError && <p className="operations-inline-error" role="alert">{eventError} <button type="button" onClick={onRetry}>Thử lại</button></p>}
    {!searchLoading && !eventError && events.length === 0 && <p className="operations-inline-note">Không tìm thấy sự kiện phù hợp.</p>}
    {rangeInvalid && <p className="operations-inline-error" role="alert">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
    <button className="operations-primary-button" disabled={loading || !filters.eventId || rangeInvalid}>{loading ? <RefreshCw className="animate-spin" size={15}/> : <Filter size={15}/>} Áp dụng bộ lọc</button>
  </form>;
}

function CheckinView({ logs, stats, total, page, activeResult, onResult, onPage }: {
  logs: AdminCheckinLog[]; stats: CheckinLogStats; total: number; page: number;
  activeResult: string; onResult: (result: string) => void; onPage: (page: number) => void;
}) {
  const cards = [
    { key: "", label: "Tổng lượt quét", value: stats.total, icon: ScanLine, tone: "cyan" },
    { key: "SUCCESS", label: "Vào cổng thành công", value: stats.success, icon: CheckCircle2, tone: "green" },
    { key: "FAILED", label: "Lượt bị từ chối", value: stats.rejected, icon: XCircle, tone: "red" },
    { key: "ALREADY_CHECKED_IN", label: "Vé quét trùng", value: stats.duplicate, icon: Clock3, tone: "amber" },
    { key: "INVALID", label: "Mã giả / không hợp lệ", value: stats.invalid, icon: ShieldAlert, tone: "violet" },
  ];
  return <>
    <div className="operations-metric-grid checkin">{cards.map(({ key, label, value, icon: Icon, tone }) => <button key={label} className={`operations-metric-card ${tone}`} aria-pressed={activeResult === key} onClick={() => onResult(key)}><Icon size={19}/><span>{label}</span><strong>{formatNumber(value)}</strong><small>Nhấn để lọc</small></button>)}</div>
    <section className="operations-data-panel">
      <header><div><span className="operations-kicker">AUDIT THEO THỜI GIAN THỰC</span><h3>Chi tiết từng lượt quét</h3></div><span className="operations-count">{formatNumber(total)} kết quả phù hợp</span></header>
      {logs.length === 0 ? <div className="operations-empty"><ScanLine size={34}/><strong>Không có lượt quét phù hợp</strong><span>Hãy đổi sự kiện, khoảng ngày hoặc trạng thái lọc.</span></div> : <div className="operations-table-wrap"><table className="operations-table">
        <thead><tr><th>Thời gian chính xác</th><th>Vé / mã đã che</th><th>Nhân viên thực hiện</th><th>Trạng thái</th><th>Diễn giải</th></tr></thead>
        <tbody>{logs.map((log) => <tr key={log.id}>
          <td><strong>{formatTime(log.checkedAt)}</strong><small>Log #{log.id}</small></td>
          <td><strong className="operations-code">{log.ticketCode ?? log.scannedCode ?? "Không xác định"}</strong><small>{log.ticketCode ? "Vé đã xác định" : "Không lưu mã QR gốc"}</small></td>
          <td><strong>{log.staffName}</strong><small>Nhân viên #{log.staffId}</small></td>
          <td><span className={`operations-result ${statusTone(log.result)}`}>{resultLabels[log.result] ?? log.result}</span></td>
          <td>{log.message ?? resultLabels[log.result] ?? "—"}</td>
        </tr>)}</tbody>
      </table></div>}
      <nav className="operations-pagination" aria-label="Phân trang lịch sử"><button disabled={page <= 1} onClick={() => onPage(page - 1)}>Trang trước</button><span>Trang <strong>{page}</strong> / {Math.max(1, Math.ceil(total / 20))}</span><button disabled={page * 20 >= total} onClick={() => onPage(page + 1)}>Trang sau</button></nav>
    </section>
  </>;
}

function ReportView({ report }: { report: EventReport }) {
  const cards = [
    { label: "Tổng thu mô phỏng", value: formatMoney(report.grossRevenue), hint: `${formatNumber(report.confirmedOrders)} đơn xác nhận`, icon: WalletCards, tone: "green" },
    { label: "Thu ròng mô phỏng", value: formatMoney(report.netRevenue), hint: `Đã hoàn ${formatMoney(report.refundedAmount)}`, icon: BarChart3, tone: "cyan" },
    { label: "Tỷ lệ lấp đầy", value: `${formatNumber(report.fillRate)}%`, hint: `${formatNumber(report.soldTickets)} / ${formatNumber(report.capacity)} vé`, icon: TicketCheck, tone: "violet" },
    { label: "Tỷ lệ tham dự", value: `${formatNumber(report.attendanceRate)}%`, hint: `${formatNumber(report.admissions)} / ${formatNumber(report.soldTickets)} vé đã bán`, icon: Users, tone: "amber" },
  ];
  return <>
    <div className="operations-metric-grid reports">{cards.map(({ label, value, hint, icon: Icon, tone }) => <article className={`operations-metric-card ${tone}`} key={label}><Icon size={19}/><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>)}</div>
    <div className="operations-report-grid">
      <section className="operations-data-panel operations-chart-panel"><header><div><span className="operations-kicker">ĐỐI SOÁT TÀI CHÍNH</span><h3>Doanh thu theo kỳ</h3></div></header>
        {report.revenueSeries.length === 0 ? <div className="operations-empty"><BarChart3 size={34}/><strong>Chưa có giao dịch trong kỳ</strong><span>Biểu đồ sẽ xuất hiện khi có thanh toán hoặc hoàn tiền hoàn tất.</span></div> : <div className="operations-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={report.revenueSeries} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs><linearGradient id="netRevenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35}/><stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/></linearGradient></defs>
          <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false}/><XAxis dataKey="period" stroke="#607990" tickLine={false}/><YAxis stroke="#607990" tickLine={false} tickFormatter={(value) => new Intl.NumberFormat("vi-VN", { notation: "compact" }).format(value)}/>
          <Tooltip formatter={(value, name) => [formatMoney(Number(value)), name === "grossRevenue" ? "Đã thu" : name === "refundedAmount" ? "Đã hoàn" : "Thu ròng"]}/><Legend formatter={(value) => value === "grossRevenue" ? "Đã thu" : value === "refundedAmount" ? "Đã hoàn" : "Thu ròng"}/>
          <Area type="monotone" dataKey="grossRevenue" stroke="#34d399" fillOpacity={0} strokeWidth={2}/><Area type="monotone" dataKey="refundedAmount" stroke="#fb7185" fillOpacity={0} strokeWidth={2}/><Area type="monotone" dataKey="netRevenue" stroke="#22d3ee" fill="url(#netRevenueFill)" strokeWidth={2}/>
        </AreaChart></ResponsiveContainer></div>}
      </section>
      <section className="operations-data-panel operations-reconcile"><header><div><span className="operations-kicker">HIỆU QUẢ SỰ KIỆN</span><h3>Đối chiếu vận hành</h3></div></header><dl>
        <div><dt>Vé phát hành</dt><dd>{formatNumber(report.issuedTickets)}</dd></div><div><dt>Vé đã vào cổng</dt><dd>{formatNumber(report.admissions)}</dd></div><div><dt>Tổng lượt quét</dt><dd>{formatNumber(report.scans)}</dd></div><div className="danger"><dt>Lượt quét bị từ chối</dt><dd>{formatNumber(report.rejectedScans)}</dd></div>
      </dl><p><AlertTriangle size={15}/> Số tiền là dữ liệu thanh toán mô phỏng. Thu ròng chỉ trừ các hoàn tiền đã hoàn tất trong kỳ đã chọn.</p></section>
    </div>
  </>;
}

export function AdminOperationsPage({ kind }: { kind: "reports" | "checkins" }) {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState<ReportEvent[]>([]);
  const [eventError, setEventError] = useState("");
  const [searchLoading, setSearchLoading] = useState(true);
  const [eventReload, setEventReload] = useState(0);
  const [filters, setFilters] = useState<OperationFilters>({ eventId: "", from: "", to: "", groupBy: "day" });
  const [applied, setApplied] = useState<OperationFilters | null>(null);
  const [report, setReport] = useState<EventReport | null>(null);
  const [logs, setLogs] = useState<AdminCheckinLog[]>([]);
  const [stats, setStats] = useState<CheckinLogStats>(emptyStats);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchReportEvents(search, token, controller.signal).then(({ data }) => {
        if (!controller.signal.aborted) { setEvents(data); setEventError(""); }
      }).catch((cause: unknown) => { if (!controller.signal.aborted) setEventError(errorMessage(cause)); })
        .finally(() => { if (!controller.signal.aborted) setSearchLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, token, eventReload]);

  useEffect(() => {
    if (!applied) return;
    const controller = new AbortController();
    const request = kind === "reports"
      ? loadReport(applied, token, controller.signal).then(({ data }) => setReport(data))
      : loadAdminLogs(applied, page, token, controller.signal).then(({ data, meta }) => { setLogs(data); setTotal(meta?.total ?? 0); setStats(meta?.stats ?? emptyStats); });
    request.then(() => { if (!controller.signal.aborted) setError(""); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [applied, page, token, reload, kind]);

  const selectedEvent = useMemo(() => events.find((event) => String(event.id) === applied?.eventId), [events, applied]);
  function update(key: keyof OperationFilters, value: string) { setFilters((current) => ({ ...current, [key]: value })); }
  function submitFilters() { setLoading(true); setApplied({ ...filters }); setPage(1); setExportError(""); setReload((value) => value + 1); }
  function filterLogs(result: string) { if (!applied) return; const next = { ...applied, result }; setLoading(true); setFilters((current) => ({ ...current, result })); setApplied(next); setPage(1); }
  async function download() {
    if (!applied || exporting) return;
    setExporting(true); setExportError("");
    try {
      const blob = await exportOperations(kind, applied, token); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `ticketbox-${kind}-${applied.eventId}.xlsx`; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setExportError(errorMessage(cause)); } finally { setExporting(false); }
  }

  return <section className="admin-operations-page">
    <header className="factory-module-hero operations-hero"><div><div className="admin-live-label">{kind === "reports" ? <BarChart3 size={13}/> : <ScanLine size={13}/>} {kind === "reports" ? "EVENT INTELLIGENCE" : "GATE AUDIT CONTROL"}</div><h2>{kind === "reports" ? "Báo cáo & Thống kê" : "Lịch sử vào cổng"}</h2><p>{kind === "reports" ? "Đánh giá doanh thu mô phỏng, tỷ lệ lấp đầy và tỷ lệ tham dự theo từng sự kiện." : "Theo dõi chính xác vé nào được quét, thời điểm, nhân viên thực hiện và mọi lượt bị từ chối."}</p></div><div className="factory-module-core">{kind === "reports" ? <BarChart3 size={28}/> : <ScanLine size={28}/>}</div></header>
    <FilterPanel kind={kind} filters={filters} events={events} search={search} searchLoading={searchLoading} eventError={eventError} loading={loading} onSearch={(value) => { setSearch(value); setSearchLoading(true); update("eventId", ""); }} onChange={update} onSubmit={submitFilters} onRetry={() => { setSearchLoading(true); setEventReload((value) => value + 1); }}/>
    {error && <div className="operations-error" role="alert"><AlertTriangle size={18}/><span>{error}</span><button onClick={() => { setLoading(true); setReload((value) => value + 1); }}>Thử lại</button></div>}
    {!applied && <div className="operations-empty operations-welcome"><Filter size={36}/><strong>Chọn một sự kiện để bắt đầu</strong><span>Dữ liệu chỉ tải sau khi bạn áp dụng bộ lọc.</span></div>}
    {applied && !error && <><div className="operations-context-bar"><div><span>Đang xem</span><strong>{selectedEvent?.name ?? `Sự kiện #${applied.eventId}`}</strong><small>{applied.from || "Từ đầu"} → {applied.to || "Đến nay"}</small></div><button disabled={exporting || loading} onClick={() => void download()}><Download size={15}/>{exporting ? "Đang tạo file…" : "Xuất Excel"}</button></div>
      {exportError && <p className="operations-inline-error" role="alert">{exportError}</p>}
      {loading ? <div className="operations-loading" role="status"><RefreshCw className="animate-spin" size={22}/> Đang tổng hợp dữ liệu…</div> : kind === "reports" ? report && <ReportView report={report}/> : <CheckinView logs={logs} stats={stats} total={total} page={page} activeResult={applied.result ?? ""} onResult={filterLogs} onPage={(next) => { setLoading(true); setPage(next); }}/>}</>}
  </section>;
}
