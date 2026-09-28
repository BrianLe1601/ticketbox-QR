import { useEffect, useState } from 'react';
import { History, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getAssignmentCheckins, getStaffAssignments } from '@/services/checkin.service';
import type { CheckinLog, StaffAssignment } from '@/services/checkin.service';

const labels: Record<string, string> = { SUCCESS: 'Thành công', ALREADY_CHECKED_IN: 'Đã check-in', WRONG_EVENT: 'Sai sự kiện', CANCELLED: 'Vé đã hủy', UNPAID: 'Chưa thanh toán', INVALID: 'Không hợp lệ', EVENT_NOT_AVAILABLE: 'Ngoài giờ check-in', STAFF_NOT_ASSIGNED: 'Chưa phân công' };
const format = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function StaffHistoryPage() {
  const { token } = useAuth();
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentTotal, setAssignmentTotal] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [logs, setLogs] = useState<CheckinLog[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [logReload, setLogReload] = useState(0);
  const [result, setResult] = useState<CheckinLog['code'] | ''>('');
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [logsError, setLogsError] = useState('');
  const assignmentLimit = 20;
  const logLimit = 20;

  useEffect(() => {
    const controller = new AbortController();
    getStaffAssignments(token, { segment: 'history', page: assignmentPage, limit: assignmentLimit }, controller.signal)
      .then(({ data, meta }) => {
        if (!controller.signal.aborted) {
          setAssignments(data); setAssignmentTotal(meta?.total ?? 0);
          setLogPage(1);
          if (data.length === 0) {
            setSelectedId(''); setLogs([]); setLogTotal(0); setLoadingLogs(false); setLogsError('');
          } else {
            setLoadingLogs(true);
            setSelectedId((current) => data.some((item) => String(item.assignmentId) === current) ? current : String(data[0]!.assignmentId));
          }
          setAssignmentError('');
        }
      })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setAssignmentError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử phân công.'); })
      .finally(() => { if (!controller.signal.aborted) setLoadingAssignments(false); });
    return () => controller.abort();
  }, [token, assignmentPage]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    getAssignmentCheckins(Number(selectedId), token, { page: logPage, limit: logLimit, result: result || undefined }, controller.signal)
      .then(({ data, meta }) => { if (!controller.signal.aborted) { setLogs(data); setLogTotal(meta?.total ?? 0); setLogsError(''); } })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setLogsError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử check-in.'); })
      .finally(() => { if (!controller.signal.aborted) setLoadingLogs(false); });
    return () => controller.abort();
  }, [selectedId, token, logPage, result, logReload]);

  const assignmentPages = Math.max(1, Math.ceil(assignmentTotal / assignmentLimit));
  const logPages = Math.max(1, Math.ceil(logTotal / logLimit));
  return <div className="space-y-5">
    <div><h2 className="text-xl font-bold text-slate-100">Lịch sử cá nhân</h2><p className="mt-1 text-sm text-slate-400">Chỉ hiển thị các lượt quét của bạn, kể cả khi Event đã kết thúc hoặc phân công đã được thu hồi.</p></div>
    {assignmentError && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300" role="alert">{assignmentError}</div>}
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-4"><label className="grid gap-1.5 text-sm font-semibold text-slate-200"><span className="flex items-center gap-2"><History size={17} className="text-cyan-400" />Phân công đã qua</span><select value={selectedId} disabled={loadingAssignments || assignments.length === 0} onChange={(event) => { setLoadingLogs(true); setLogPage(1); setSelectedId(event.target.value); }} className="min-h-[40px] min-w-72 rounded-lg border border-cyan-500/30 bg-slate-950 px-3 text-sm text-slate-100 focus-visible:outline-2 focus-visible:outline-cyan-300">{assignments.length === 0 ? <option value="">Chưa có lịch sử phân công</option> : assignments.map((assignment) => <option key={assignment.assignmentId} value={assignment.assignmentId}>{assignment.name} · {format(assignment.startTime)}</option>)}</select></label><label className="grid gap-1.5 text-xs font-semibold text-slate-300">Kết quả<select value={result} onChange={(event) => { setLoadingLogs(true); setLogPage(1); setResult(event.target.value as CheckinLog['code'] | ''); }} className="min-h-[40px] rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-100"><option value="">Tất cả kết quả</option>{Object.entries(labels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label><button type="button" disabled={loadingLogs || !selectedId} onClick={() => { setLoadingLogs(true); setLogPage(1); setLogReload((value) => value + 1); }} className="staff-page-button"><RefreshCw size={14} className={loadingLogs ? 'animate-spin' : ''} />Làm mới</button></div>
    {assignmentPages > 1 && <nav className="flex justify-end gap-2 text-xs text-slate-400" aria-label="Phân trang phân công lịch sử"><button className="staff-page-button" type="button" disabled={assignmentPage === 1} onClick={() => { setLoadingAssignments(true); setAssignmentPage((page) => page - 1); }}><ChevronLeft size={14} />Trước</button><span className="self-center">{assignmentPage}/{assignmentPages}</span><button className="staff-page-button" type="button" disabled={assignmentPage === assignmentPages} onClick={() => { setLoadingAssignments(true); setAssignmentPage((page) => page + 1); }}>Sau<ChevronRight size={14} /></button></nav>}
    {logsError && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300" role="alert">{logsError}</div>}
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/60"><table className="w-full text-left text-sm text-slate-200"><caption className="border-b border-white/10 p-4 text-left font-bold text-slate-100">Lượt quét do bạn thực hiện · {logTotal} kết quả</caption><thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400"><tr><th scope="col" className="p-3.5">Thời điểm</th><th scope="col" className="p-3.5">Mã quét đã che</th><th scope="col" className="p-3.5">Kết quả</th><th scope="col" className="p-3.5">Thông báo</th></tr></thead><tbody className="divide-y divide-white/5">{loadingLogs ? <tr><td colSpan={4} className="p-6 text-center text-xs text-slate-400">Đang tải lịch sử soát vé...</td></tr> : logs.length === 0 ? <tr><td colSpan={4} className="p-6 text-center text-xs text-slate-400">Chưa có lượt quét phù hợp.</td></tr> : logs.map((log) => <tr key={log.id} className="hover:bg-white/[0.02]"><td className="whitespace-nowrap p-3.5 text-xs text-slate-300">{format(log.checkedAt)}</td><td className="whitespace-nowrap p-3.5 font-mono text-xs text-cyan-300">{log.scannedCode}</td><td className="p-3.5 text-xs font-semibold text-slate-200">{labels[log.code] ?? log.code}</td><td className="p-3.5 text-xs text-slate-300">{log.message}</td></tr>)}</tbody></table></div>
    {logPages > 1 && <nav className="flex items-center justify-center gap-3" aria-label="Phân trang lịch sử lượt quét"><button className="staff-page-button" type="button" disabled={logPage === 1} onClick={() => { setLoadingLogs(true); setLogPage((page) => page - 1); }}><ChevronLeft size={16} />Trước</button><span className="text-xs text-slate-400">Trang {logPage}/{logPages}</span><button className="staff-page-button" type="button" disabled={logPage === logPages} onClick={() => { setLoadingLogs(true); setLogPage((page) => page + 1); }}>Sau<ChevronRight size={16} /></button></nav>}
  </div>;
}
