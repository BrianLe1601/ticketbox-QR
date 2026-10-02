import { useEffect, useState } from 'react';
import { Calendar, Clock, MapPin, Eye, ScanLine, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { StaffEventDetailDialog } from '@/components/staff/StaffEventDetailDialog';
import { getStaffAssignments } from '@/services/checkin.service';
import type { AssignmentOperationalState, AssignmentSegment, StaffAssignment } from '@/services/checkin.service';

const statusMeta: Record<AssignmentOperationalState, { label: string; tone: string }> = {
  checkin_open: { label: 'Đang mở check-in', tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  upcoming: { label: 'Sắp tới', tone: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  preparing: { label: 'Đang chuẩn bị', tone: 'bg-violet-500/20 text-violet-200 border-violet-500/30' },
  checkin_closed: { label: 'Đã đóng cổng', tone: 'bg-slate-700 text-slate-300 border-slate-600' },
  completed: { label: 'Đã kết thúc', tone: 'bg-slate-700 text-slate-300 border-slate-600' },
  cancelled: { label: 'Đã hủy', tone: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  revoked: { label: 'Đã thu hồi phân công', tone: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
};
const segments: Array<{ value: AssignmentSegment; label: string }> = [
  { value: 'all', label: 'Tất cả' }, { value: 'open', label: 'Đang mở' }, { value: 'upcoming', label: 'Sắp tới' }, { value: 'history', label: 'Lịch sử' },
];
const format = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

export function StaffEventsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSegment = searchParams.get('segment');
  const segment: AssignmentSegment = segments.some((item) => item.value === requestedSegment)
    ? requestedSegment as AssignmentSegment
    : 'all';
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<StaffAssignment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<StaffAssignment | null>(null);
  const [reload, setReload] = useState(0);
  const limit = 12;

  useEffect(() => {
    const controller = new AbortController();
    getStaffAssignments(token, { segment, page, limit }, controller.signal)
      .then(({ data, meta }) => { if (!controller.signal.aborted) { setEvents(data); setTotal(meta?.total ?? 0); setError(''); } })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không thể tải danh sách phân công.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, segment, page, reload]);

  useEffect(() => {
    const timer = window.setInterval(() => setReload((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const pages = Math.max(1, Math.ceil(total / limit));
  const selectSegment = (next: AssignmentSegment) => {
    setLoading(true);
    setPage(1);
    setSearchParams(next === 'all' ? {} : { segment: next });
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-100">Sự kiện được phân công</h2><p className="mt-1 text-sm text-slate-400">Xem thông tin Event và ca trực cá nhân; lịch sử là dữ liệu chỉ đọc.</p></div><span className="text-xs text-slate-400">{total} phân công</span></div>
    <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Bộ lọc phân công">{segments.map((item) => <button key={item.value} type="button" onClick={() => selectSegment(item.value)} aria-pressed={segment === item.value} className={`min-h-[38px] rounded-lg border px-3.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-cyan-300 ${segment === item.value ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-200' : 'border-white/10 bg-slate-900 text-slate-400 hover:text-slate-200'}`}>{item.label}</button>)}</div>
    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300" role="alert">{error}</div>}
    {loading ? <p className="text-sm text-slate-400" role="status">Đang tải danh sách phân công...</p>
      : events.length === 0 ? <div className="rounded-xl border border-white/10 bg-slate-900/40 p-8 text-center text-sm text-slate-400">Không có phân công nào trong nhóm này.</div>
        : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{events.map((event) => {
          const state = statusMeta[event.operationalState];
          return <article key={event.assignmentId} className="flex flex-col justify-between gap-4 rounded-xl border border-white/10 bg-slate-900/60 p-4">
            <div><span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${state.tone}`}>{state.label}</span><h3 className="mt-2 text-base font-bold text-slate-100">{event.name}</h3><p className="mt-2 flex items-start gap-1.5 text-xs text-slate-400"><MapPin size={14} className="mt-0.5 shrink-0 text-cyan-400" />{event.venue}, {event.city}</p><p className="mt-1 flex items-start gap-1.5 text-xs text-slate-400"><Calendar size={14} className="mt-0.5 shrink-0 text-indigo-400" />{format(event.startTime)} — {format(event.endTime)}</p><p className="mt-1 flex items-start gap-1.5 text-xs text-amber-200"><Clock size={14} className="mt-0.5 shrink-0" />Cổng: {format(event.checkinStartAt)} — {format(event.checkinEndAt)}</p></div>
            <div className="flex gap-2 border-t border-white/5 pt-3"><button type="button" onClick={() => setDetail(event)} className="flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5"><Eye size={14} />Chi tiết</button>{event.operationalState === 'checkin_open' && <button type="button" onClick={() => navigate(`/staff/check-in?eventId=${event.eventId}`)} className="flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500"><ScanLine size={14} />Soát vé</button>}</div>
          </article>;
        })}</div>}
    {pages > 1 && <nav className="flex items-center justify-center gap-3" aria-label="Phân trang phân công"><button type="button" disabled={page === 1} onClick={() => { setLoading(true); setPage((value) => value - 1); }} className="staff-page-button"><ChevronLeft size={16} />Trước</button><span className="text-xs text-slate-400">Trang {page}/{pages}</span><button type="button" disabled={page === pages} onClick={() => { setLoading(true); setPage((value) => value + 1); }} className="staff-page-button">Sau<ChevronRight size={16} /></button></nav>}
    <StaffEventDetailDialog assignment={detail} onClose={() => setDetail(null)} />
  </div>;
}
