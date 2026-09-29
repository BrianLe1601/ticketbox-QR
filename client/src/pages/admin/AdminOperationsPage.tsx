import {
  AlertCircle, BarChart3, CalendarDays, CheckCircle2, ChevronLeft,
  ChevronRight, CircleDollarSign, ClipboardCheck, FileSpreadsheet, Filter, LoaderCircle,
  RefreshCw, ScanLine, Search, Ticket, UserRound, XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { exportOperations, loadAdminLogs, loadReport, searchReportEvents } from '@/services/report.service';
import type { AdminCheckinLog, EventReport, OperationFilters, ReportEvent } from '@/services/report.service';

const field = 'operations-field';
const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Không thể kết nối máy chủ.';
const number = (value: number) => Number(value).toLocaleString('vi-VN');
const money = (value: number) => `${number(value)} ₫`;
const time = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const results = ['SUCCESS', 'ALREADY_CHECKED_IN', 'WRONG_EVENT', 'CANCELLED', 'UNPAID', 'INVALID', 'EVENT_NOT_AVAILABLE', 'STAFF_NOT_ASSIGNED'];
const resultLabels: Record<string, string> = {
  SUCCESS: 'Thành công', ALREADY_CHECKED_IN: 'Đã check-in trước đó', WRONG_EVENT: 'Sai sự kiện',
  CANCELLED: 'Vé đã hủy', UNPAID: 'Chưa thanh toán', INVALID: 'Không hợp lệ',
  EVENT_NOT_AVAILABLE: 'Sự kiện không khả dụng', STAFF_NOT_ASSIGNED: 'Nhân viên chưa được phân công',
};

function percentage(value: number, total: number) { return total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0; }
function ResultBadge({ result }: { result: string }) {
  const isSuccess = result === 'SUCCESS';
  return <span className={`operations-result-badge ${isSuccess ? 'is-success' : 'is-warning'}`}>
    {isSuccess ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}{resultLabels[result] ?? result}
  </span>;
}
function MetricCard({ label, value, note, tone = 'cyan', icon: Icon }: {
  label: string; value: string; note: string; tone?: 'cyan' | 'violet' | 'green' | 'amber'; icon: typeof Ticket;
}) {
  return <article className={`operations-metric is-${tone}`}><div className="operations-metric-icon"><Icon size={18} /></div>
    <div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>;
}

export function AdminOperationsPage({ kind }: { kind: 'reports' | 'checkins' }) {
  const { token } = useAuth();
  const isReport = kind === 'reports';
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<ReportEvent[]>([]);
  const [eventError, setEventError] = useState('');
  const [searchLoading, setSearchLoading] = useState(true);
  const [eventReload, setEventReload] = useState(0);
  const [filters, setFilters] = useState<OperationFilters>({ eventId: '', from: '', to: '' });
  const [applied, setApplied] = useState<OperationFilters | null>(null);
  const [report, setReport] = useState<EventReport | null>(null);
  const [logs, setLogs] = useState<AdminCheckinLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [reload, setReload] = useState(0);
  const selectedEvent = useMemo(() => events.find((event) => String(event.id) === filters.eventId), [events, filters.eventId]);
  const pageCount = Math.max(1, Math.ceil(total / 20));
  const rangeInvalid = !!(filters.from && filters.to && filters.from > filters.to);
  const admissionRate = report ? percentage(report.admissions, report.issuedTickets) : 0;
  const scanSuccessRate = report ? percentage(report.admissions, report.scans) : 0;

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchReportEvents(search, token, controller.signal).then(({ data }) => {
        if (!controller.signal.aborted) { setEvents(data); setEventError(''); }
      }).catch((cause: unknown) => { if (!controller.signal.aborted) setEventError(message(cause)); })
        .finally(() => { if (!controller.signal.aborted) setSearchLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, token, eventReload]);
  useEffect(() => {
    if (!applied) return;
    const controller = new AbortController();
    async function load() {
      try {
        if (isReport) {
          const { data } = await loadReport(applied, token, controller.signal);
          if (!controller.signal.aborted) setReport(data);
        } else {
          const { data, meta } = await loadAdminLogs(applied, page, token, controller.signal);
          if (!controller.signal.aborted) { setLogs(data); setTotal(meta?.total ?? 0); }
        }
        if (!controller.signal.aborted) setError('');
      } catch (cause) { if (!controller.signal.aborted) setError(message(cause)); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [applied, page, token, reload, isReport]);

  function update(key: keyof OperationFilters, value: string) { setFilters((current) => ({ ...current, [key]: value })); }
  function applyFilters() {
    if (rangeInvalid) return;
    setApplied({ ...filters }); setPage(1); setLoading(true); setExportError(''); setReload((value) => value + 1);
  }
  async function download() {
    if (!applied || exporting) return;
    setExporting(true); setExportError('');
    try {
      const blob = await exportOperations(kind, applied, token); const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `ticketbox-${kind}-${applied.eventId}.xlsx`;
      document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setExportError(message(cause)); } finally { setExporting(false); }
  }

  return <section className="operations-page">
    <header className="operations-hero">
      <div className={`operations-hero-icon ${isReport ? 'is-violet' : 'is-cyan'}`}>{isReport ? <BarChart3 size={23} /> : <ScanLine size={23} />}</div>
      <div><span className="operations-eyebrow">VẬN HÀNH SỰ KIỆN</span><h2>{isReport ? 'Báo cáo sự kiện' : 'Nhật ký check-in'}</h2><p>{isReport ? 'Theo dõi doanh thu mô phỏng, vé và mức độ tham dự theo từng sự kiện.' : 'Tra cứu mọi lượt quét vé, bao gồm kết quả hợp lệ và các lượt bị từ chối.'}</p></div>
      <div className="operations-hero-status"><span />DỮ LIỆU TỪ HỆ THỐNG</div>
    </header>
    <form className="operations-filter-panel" onSubmit={(event) => { event.preventDefault(); applyFilters(); }}>
      <div className="operations-panel-heading"><div><Filter size={17} /><div><span>BỘ LỌC PHẠM VI</span><h3>Chọn dữ liệu cần xem</h3></div></div><p>Giờ Việt Nam (GMT+7)</p></div>
      <div className="operations-filter-grid">
        <label className="operations-filter-search"><span>Tìm sự kiện</span><div><Search size={16} /><input className={field} value={search} maxLength={100} onChange={(event) => { setSearch(event.target.value); setSearchLoading(true); update('eventId', ''); }} placeholder="Nhập tên sự kiện" /></div></label>
        <label><span>Sự kiện <b>*</b></span><select className={field} required value={filters.eventId} onChange={(event) => update('eventId', event.target.value)}><option value="">Chọn sự kiện</option>{events.map((event) => <option value={event.id} key={event.id}>{event.name}</option>)}</select></label>
        <label><span>Từ ngày</span><div className="operations-input-with-icon"><CalendarDays size={15} /><input className={field} type="date" value={filters.from} onChange={(event) => update('from', event.target.value)} /></div></label>
        <label><span>Đến hết ngày</span><div className="operations-input-with-icon"><CalendarDays size={15} /><input className={field} type="date" value={filters.to} onChange={(event) => update('to', event.target.value)} /></div></label>
        {!isReport && <><label><span>Mã nhân viên</span><div className="operations-input-with-icon"><UserRound size={15} /><input className={field} type="number" min="1" step="1" value={filters.staffId ?? ''} onChange={(event) => update('staffId', event.target.value)} placeholder="Tất cả" /></div></label><label><span>Kết quả quét</span><select className={field} value={filters.result ?? ''} onChange={(event) => update('result', event.target.value)}><option value="">Tất cả kết quả</option>{results.map((result) => <option key={result} value={result}>{resultLabels[result]}</option>)}</select></label></>}
      </div>
      <div className="operations-filter-footer"><div className="operations-filter-feedback">
        {searchLoading && <span role="status"><LoaderCircle size={14} />Đang tìm sự kiện…</span>}
        {!searchLoading && !eventError && selectedEvent && <span className="is-ready"><CheckCircle2 size={14} />Đã chọn: {selectedEvent.name}</span>}
        {!searchLoading && !eventError && !events.length && <span><AlertCircle size={14} />Không tìm thấy sự kiện phù hợp.</span>}
        {events.length === 100 && <span>Hiển thị 100 sự kiện; hãy thu hẹp từ khóa.</span>}
        {eventError && <span className="is-error" role="alert">{eventError}<button type="button" onClick={() => { setSearchLoading(true); setEventReload((value) => value + 1); }}>Thử lại</button></span>}
        {rangeInvalid && <span className="is-error" role="alert"><AlertCircle size={14} />Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</span>}
      </div><button className="operations-apply-button" disabled={loading || !filters.eventId || rangeInvalid}><Filter size={16} />{loading ? 'Đang tải dữ liệu…' : 'Áp dụng bộ lọc'}</button></div>
    </form>
    {loading && <div className="operations-loading" role="status"><LoaderCircle size={20} />Đang đồng bộ dữ liệu vận hành…</div>}
    {error && <div className="operations-alert is-error" role="alert"><AlertCircle size={19} /><div><strong>Không thể tải dữ liệu</strong><p>{error}</p></div><button type="button" onClick={() => { setLoading(true); setReload((value) => value + 1); }}><RefreshCw size={15} />Thử lại</button></div>}
    {!applied && !loading && <div className="operations-empty"><div>{isReport ? <BarChart3 size={28} /> : <ScanLine size={28} />}</div><h3>Sẵn sàng xem dữ liệu</h3><p>Chọn một sự kiện, sau đó áp dụng bộ lọc để xem {isReport ? 'báo cáo tổng hợp' : 'lịch sử quét vé'}.</p></div>}
    {applied && !loading && !error && <div className="operations-results">
      <div className="operations-results-toolbar"><div><span>{isReport ? 'BẢNG TỔNG HỢP' : 'DÒNG NHẬT KÝ'}</span><h3>{isReport && report ? report.name : 'Kết quả theo bộ lọc'}</h3><p>Sự kiện #{applied.eventId} <i /> {applied.from || 'Từ đầu'} — {applied.to || 'Đến nay'}</p></div><button className="operations-export-button" disabled={exporting} onClick={() => { void download(); }}><FileSpreadsheet size={16} />{exporting ? 'Đang tạo Excel…' : 'Xuất Excel'}</button></div>
      {exportError && <div className="operations-inline-error" role="alert"><AlertCircle size={14} />{exportError}</div>}
      {isReport && report && <><div className="operations-section-label"><CircleDollarSign size={15} /><span>HIỆU QUẢ GIAO DỊCH MÔ PHỎNG</span></div><div className="operations-metric-grid">
        <MetricCard label="Thanh toán mô phỏng" value={money(report.grossRevenue)} note="Giá trị đơn đã xác nhận" icon={CircleDollarSign} /><MetricCard label="Hoàn tiền mô phỏng" value={money(report.refundedAmount)} note="Đã hoàn tất trong kỳ" tone="amber" icon={RefreshCw} /><MetricCard label="Thu ròng mô phỏng" value={money(report.netRevenue)} note="Sau hoàn tiền mô phỏng" tone="violet" icon={BarChart3} /><MetricCard label="Đơn xác nhận" value={number(report.confirmedOrders)} note="Đơn hàng hợp lệ" tone="green" icon={ClipboardCheck} />
      </div><div className="operations-section-label"><Ticket size={15} /><span>VÉ VÀ LƯỢT VÀO CỔNG</span></div><div className="operations-metric-grid">
        <MetricCard label="Vé đã bán" value={number(report.soldTickets)} note="Theo ngày xác nhận" icon={Ticket} /><MetricCard label="Vé đã phát hành" value={number(report.issuedTickets)} note="Theo ngày phát hành" tone="violet" icon={Ticket} /><MetricCard label="Vé đã vào cổng" value={number(report.admissions)} note={`${admissionRate}% trên vé phát hành`} tone="green" icon={CheckCircle2} /><MetricCard label="Tổng lần quét" value={number(report.scans)} note="Gồm cả lượt bị từ chối" tone="violet" icon={ScanLine} /><MetricCard label="Lượt quét bị từ chối" value={number(report.rejectedScans)} note={`${scanSuccessRate}% lượt quét thành công`} tone="amber" icon={XCircle} />
      </div><div className="operations-insight-grid"><article><div className="operations-progress-heading"><span>Tỷ lệ tham dự</span><strong>{admissionRate}%</strong></div><div className="operations-progress"><span style={{ width: `${admissionRate}%` }} /></div><p>{number(report.admissions)} / {number(report.issuedTickets)} vé phát hành đã vào cổng.</p></article><article><div className="operations-progress-heading"><span>Chất lượng quét vé</span><strong>{scanSuccessRate}%</strong></div><div className="operations-progress is-violet"><span style={{ width: `${scanSuccessRate}%` }} /></div><p>{number(report.admissions)} lượt hợp lệ trên {number(report.scans)} lượt quét.</p></article></div><p className="operations-disclaimer">Các số tiền chỉ mô phỏng cho đồ án, không phản ánh giao dịch ngân hàng hoặc cổng thanh toán thật. Thu ròng có thể âm khi hoàn cho đơn mua trước kỳ này; lượt vào giữ lịch sử kể cả sau khi hủy sự kiện.</p></>}
      {!isReport && <><div className="operations-log-summary"><div><ScanLine size={17} /><span>{number(total)} lượt quét phù hợp</span></div><p>Trang {page} / {pageCount}</p></div>{logs.length === 0 ? <div className="operations-empty is-compact"><div><ScanLine size={25} /></div><h3>Không có lượt quét phù hợp</h3><p>Hãy điều chỉnh ngày, nhân viên hoặc kết quả quét trong bộ lọc.</p></div> : <div className="operations-table-wrap"><table className="operations-log-table"><caption className="sr-only">Lịch sử check-in theo bộ lọc</caption><thead><tr>{['Thời điểm', 'Nhân viên', 'Vé / mã che', 'Kết quả', 'Thông báo'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{logs.map((log) => <tr key={log.id} className={log.result === 'SUCCESS' ? 'is-success' : 'is-warning'}><td data-label="Thời điểm"><time dateTime={log.checkedAt}>{time(log.checkedAt)}</time></td><td data-label="Nhân viên"><span className="operations-staff"><UserRound size={14} /><span>{log.staffName}<small>Nhân viên #{log.staffId}</small></span></span></td><td data-label="Vé / mã che"><code>{log.ticketCode ?? log.scannedCode ?? '—'}</code></td><td data-label="Kết quả"><ResultBadge result={log.result} /></td><td data-label="Thông báo"><span className="operations-log-message">{log.message ?? '—'}</span></td></tr>)}</tbody></table></div>}<nav aria-label="Phân trang lịch sử check-in" className="operations-pagination"><button type="button" disabled={page <= 1} onClick={() => { setLoading(true); setPage((value) => value - 1); }}><ChevronLeft size={16} />Trước</button><span>Trang <strong>{page}</strong> trên {pageCount}</span><button type="button" disabled={page * 20 >= total} onClick={() => { setLoading(true); setPage((value) => value + 1); }}>Sau<ChevronRight size={16} /></button></nav></>}
    </div>}
  </section>;
}
