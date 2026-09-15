import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { exportOperations, loadAdminLogs, loadReport, searchReportEvents } from '@/services/report.service';
import type { AdminCheckinLog, EventReport, OperationFilters, ReportEvent } from '@/services/report.service';

const field = 'w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-2 focus:outline-cyan-300';
const button = 'rounded-lg border border-cyan-500/40 px-4 py-2 hover:bg-cyan-400/10 focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed';
const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Không thể kết nối máy chủ.';
const number = (value: number) => Number(value).toLocaleString('vi-VN');
const time = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const results = ['SUCCESS', 'ALREADY_CHECKED_IN', 'WRONG_EVENT', 'CANCELLED', 'UNPAID', 'INVALID', 'EVENT_NOT_AVAILABLE', 'STAFF_NOT_ASSIGNED'];

export function AdminOperationsPage({ kind }: { kind: 'reports' | 'checkins' }) {
  const { token } = useAuth();
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
        if (kind === 'reports') {
          const { data } = await loadReport(applied!, token, controller.signal);
          if (!controller.signal.aborted) setReport(data);
        } else {
          const { data, meta } = await loadAdminLogs(applied!, page, token, controller.signal);
          if (!controller.signal.aborted) { setLogs(data); setTotal(meta?.total ?? 0); }
        }
        if (!controller.signal.aborted) setError('');
      } catch (cause) { if (!controller.signal.aborted) setError(message(cause)); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [applied, page, token, reload, kind]);
  function update(key: keyof OperationFilters, value: string) { setFilters((current) => ({ ...current, [key]: value })); }
  async function download() {
    if (!applied || exporting) return;
    setExporting(true); setExportError('');
    try {
      const blob = await exportOperations(kind, applied, token);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `ticketbox-${kind}-${applied.eventId}.xlsx`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setExportError(message(cause)); }
    finally { setExporting(false); }
  }
  const rangeInvalid = !!(filters.from && filters.to && filters.from > filters.to);
  return <section className="space-y-5 text-slate-100">
    <div><h2 className="text-2xl font-bold">{kind === 'reports' ? 'Báo cáo sự kiện' : 'Lịch sử check-in'}</h2>
      <p className="mt-2 text-sm text-slate-400">Lọc theo sự kiện và ngày (giờ Việt Nam). Để trống ngày để xem toàn bộ lịch sử.</p></div>
    <form className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/80 p-5" onSubmit={(e) => {
      e.preventDefault(); if (rangeInvalid) return;
      setApplied({ ...filters }); setPage(1); setLoading(true); setExportError(''); setReload((value) => value + 1);
    }}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2"><span>Tìm sự kiện</span><input className={field} value={search} maxLength={100} onChange={(e) => { setSearch(e.target.value); setSearchLoading(true); update('eventId', ''); }} placeholder="Nhập tên để tìm trong danh sách" /></label>
        <label className="space-y-2"><span>Sự kiện</span><select className={field} required value={filters.eventId} onChange={(e) => update('eventId', e.target.value)}>
          <option value="">Chọn sự kiện</option>{events.map((event) => <option value={event.id} key={event.id}>{event.name}</option>)}
        </select></label>
        <label className="space-y-2"><span>Từ ngày</span><input className={field} type="date" value={filters.from} onChange={(e) => update('from', e.target.value)} /></label>
        <label className="space-y-2"><span>Đến hết ngày</span><input className={field} type="date" value={filters.to} onChange={(e) => update('to', e.target.value)} /></label>
        {kind === 'checkins' && <>
          <label className="space-y-2"><span>Staff ID (không bắt buộc)</span><input className={field} type="number" min="1" step="1" value={filters.staffId ?? ''} onChange={(e) => update('staffId', e.target.value)} /></label>
          <label className="space-y-2"><span>Kết quả</span><select className={field} value={filters.result ?? ''} onChange={(e) => update('result', e.target.value)}><option value="">Tất cả</option>{results.map((result) => <option key={result}>{result}</option>)}</select></label>
        </>}
      </div>
      {searchLoading && <p role="status">Đang tìm sự kiện…</p>}
      {eventError && <div role="alert" className="text-amber-300">{eventError} <button className={button} type="button" onClick={() => { setSearchLoading(true); setEventReload((value) => value + 1); }}>Thử lại</button></div>}
      {!searchLoading && !eventError && events.length === 0 && <p>Không tìm thấy sự kiện phù hợp.</p>}
      {events.length === 100 && <p className="text-sm text-slate-400">Hiển thị 100 sự kiện mới nhất phù hợp; nhập tên để thu hẹp danh sách.</p>}
      {rangeInvalid && <p role="alert" className="text-amber-300">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
      <button className={button} disabled={loading || !filters.eventId || rangeInvalid}>Áp dụng bộ lọc</button>
    </form>
    {loading && <p role="status">Đang tải dữ liệu…</p>}
    {error && <div role="alert" className="text-amber-300">{error} <button className={button} onClick={() => { setLoading(true); setReload((value) => value + 1); }}>Thử lại</button></div>}
    {!applied && <p className="text-slate-400">Chọn sự kiện và bấm Áp dụng bộ lọc để xem dữ liệu.</p>}
    {applied && !loading && !error && <>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-400">Event #{applied.eventId} · {applied.from || 'Từ đầu'} → {applied.to || 'Đến nay'}</p>
        <button className={button} disabled={exporting} onClick={() => { void download(); }}>{exporting ? 'Đang tạo Excel…' : 'Xuất Excel theo bộ lọc đã áp dụng'}</button></div>
      {exportError && <p role="alert" className="text-amber-300">{exportError}</p>}
      {kind === 'reports' && report && <>
        <h3 className="text-xl font-semibold">{report.name}</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{([
          ['Đã thu (VND)', report.grossRevenue], ['Đã hoàn (VND)', report.refundedAmount], ['Thu ròng (VND)', report.netRevenue],
          ['Đơn xác nhận', report.confirmedOrders], ['Vé đã bán', report.soldTickets], ['Vé phát hành', report.issuedTickets],
          ['Vé đã vào cổng', report.admissions], ['Tổng lần quét', report.scans], ['Lần quét bị từ chối', report.rejectedScans],
        ] as const).map(([label, value]) => <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-5" key={label}><p className="text-sm text-slate-400">{label}</p><strong className="mt-2 block text-2xl">{number(value)}</strong></div>)}</div>
        <p className="text-sm text-slate-400">Đã thu theo ngày thanh toán thành công; đã hoàn theo ngày hoàn tất hoàn tiền. Thu ròng có thể âm khi hoàn tiền cho đơn mua trước kỳ này. Đơn/vé bán theo ngày xác nhận, vé phát hành theo ngày phát hành, lượt vào theo log thành công (giữ lịch sử kể cả sau khi hủy sự kiện).</p>
      </>}
      {kind === 'checkins' && <>
        {logs.length === 0 ? <p className="rounded-xl border border-slate-700 p-5">Không có lần quét phù hợp.</p> : <div className="overflow-x-auto rounded-xl border border-slate-700"><table className="w-full text-left text-sm"><caption className="p-3 text-left">Lịch sử check-in · {number(total)} kết quả</caption><thead className="bg-slate-800"><tr>{['Thời điểm', 'Nhân viên', 'Vé / mã che', 'Kết quả', 'Thông báo'].map((label) => <th className="p-3" scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{logs.map((log) => <tr className="border-t border-slate-700" key={log.id}><td className="whitespace-nowrap p-3">{time(log.checkedAt)}</td><td className="p-3">{log.staffName} (#{log.staffId})</td><td className="p-3">{log.ticketCode ?? log.scannedCode ?? '—'}</td><td className={`p-3 ${log.result === 'SUCCESS' ? 'text-emerald-300' : 'text-amber-300'}`}>{log.result}</td><td className="p-3">{log.message}</td></tr>)}</tbody></table></div>}
        <nav aria-label="Phân trang lịch sử" className="flex items-center gap-3"><button className={button} disabled={page <= 1} onClick={() => { setLoading(true); setPage((value) => value - 1); }}>Trước</button><span>Trang {page} / {Math.max(1, Math.ceil(total / 20))}</span><button className={button} disabled={page * 20 >= total} onClick={() => { setLoading(true); setPage((value) => value + 1); }}>Sau</button></nav>
      </>}
    </>}
  </section>;
}
