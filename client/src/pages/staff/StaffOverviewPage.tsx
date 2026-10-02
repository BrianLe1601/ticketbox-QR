import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Clock, MapPin, ScanLine, ArrowRight, History } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getStaffOverview } from '@/services/checkin.service';
import type { StaffOverview } from '@/services/checkin.service';

const format = (value: string) => new Date(value).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

export function StaffOverviewPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<StaffOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getStaffOverview(token, controller.signal)
      .then(({ data }) => {
        if (!controller.signal.aborted) { setOverview(data); setError(''); }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu ca trực.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, reload]);

  useEffect(() => {
    const timer = window.setInterval(() => setReload((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const counts = overview?.counts ?? { total: 0, open: 0, upcoming: 0, history: 0 };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-slate-900 to-cyan-950/40 p-5 shadow-xl">
        <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Không gian vận hành nhân viên</span>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-100">Xin chào, {user?.fullName ?? 'Nhân viên'}</h1>
        <p className="mt-2 text-sm text-slate-400">Theo dõi phân công cá nhân và vận hành cổng soát vé được server xác thực theo thời gian thực.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={() => navigate('/staff/events?segment=all')} className="staff-summary-card"><span>Tổng phân công</span><strong>{counts.total}</strong></button>
        <button type="button" onClick={() => navigate('/staff/check-in')} className="staff-summary-card is-open"><span>Cổng đang mở</span><strong>{counts.open}</strong></button>
        <button type="button" onClick={() => navigate('/staff/events?segment=upcoming')} className="staff-summary-card is-upcoming"><span>Sắp tới / chuẩn bị</span><strong>{counts.upcoming}</strong></button>
        <button type="button" onClick={() => navigate('/staff/history')} className="staff-summary-card"><span>Lịch sử phân công</span><strong>{counts.history}</strong></button>
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300" role="alert">{error}</div>}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-100">Cổng check-in đang hoạt động</h2>
          <button type="button" onClick={() => { setLoading(true); setReload((value) => value + 1); }} className="text-xs font-semibold text-cyan-300 hover:text-cyan-100">Làm mới</button>
        </div>
        {loading ? <p className="text-sm text-slate-400" role="status">Đang tải dữ liệu ca trực...</p>
          : overview?.openEvents.length === 0 ? <div className="rounded-xl border border-white/10 bg-slate-900/40 p-6 text-center text-sm text-slate-400">Hiện tại không có cổng nào đang mở check-in.</div>
            : <div className="grid gap-3 sm:grid-cols-2">
              {overview?.openEvents.map((event) => (
                <article key={event.assignmentId} className="flex flex-col justify-between gap-4 rounded-xl border border-emerald-500/30 bg-slate-900/80 p-4 shadow-lg">
                  <div>
                    <span className="inline-block rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">Đang mở cổng</span>
                    <h3 className="mt-2 text-base font-bold text-slate-100">{event.name}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><MapPin size={14} className="text-cyan-400" />{event.venue} · {event.city}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-300"><Clock size={14} />Đóng cổng: {format(event.checkinEndAt)}</p>
                  </div>
                  <button type="button" onClick={() => navigate(`/staff/check-in?eventId=${event.eventId}`)} className="flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-emerald-200"><ScanLine size={16} />Vào cổng soát vé<ArrowRight size={14} /></button>
                </article>
              ))}
            </div>}
      </section>

      {overview?.nextUpcomingAssignment && <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/20 bg-slate-900/60 p-4">
        <div className="flex items-start gap-3"><CalendarClock className="mt-0.5 text-cyan-300" size={18} /><div><h2 className="font-bold text-slate-100">{overview.nextUpcomingAssignment.operationalState === 'preparing' ? 'Sự kiện đang chuẩn bị' : 'Ca trực kế tiếp'}</h2><p className="mt-1 text-sm text-slate-300">{overview.nextUpcomingAssignment.name} · {format(overview.nextUpcomingAssignment.checkinStartAt)}</p><p className="text-xs text-slate-400">{overview.nextUpcomingAssignment.venue}, {overview.nextUpcomingAssignment.city}</p></div></div>
        <button type="button" onClick={() => navigate('/staff/events?segment=upcoming')} className="flex min-h-[38px] items-center gap-2 rounded-lg border border-cyan-500/30 px-3 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"><History size={14} />Xem phân công</button>
      </section>}
    </div>
  );
}
