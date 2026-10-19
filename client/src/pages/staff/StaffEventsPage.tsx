import { useEffect, useState } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, Clock, Eye, MapPin, RefreshCw, ScanLine } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { StaffEmptyState } from '@/components/staff/StaffEmptyState';
import { StaffEventDetailDialog } from '@/components/staff/StaffEventDetailDialog';
import { useNow } from '@/hooks/useNow';
import { useStaffShell } from '@/hooks/useStaffShell';
import { ASSIGNMENT_STATE, countdownText, dateBadge, emptySegmentText, timeText } from '@/lib/staff-portal';
import { getStaffAssignments } from '@/services/checkin.service';
import type { AssignmentSegment, StaffAssignment } from '@/services/checkin.service';

const segments: Array<{ value: AssignmentSegment; label: string; count: 'total' | 'open' | 'upcoming' | 'history' }> = [
  { value: 'all', label: 'Tất cả', count: 'total' }, { value: 'open', label: 'Đang mở', count: 'open' },
  { value: 'upcoming', label: 'Sắp tới', count: 'upcoming' }, { value: 'history', label: 'Lịch sử', count: 'history' },
];
const dayRange = (start: string, end: string) => {
  const date = new Date(start).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${date} · ${timeText(start)} – ${timeText(end)}`;
};

export function StaffEventsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const shell = useStaffShell();
  const now = useNow(30_000);
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
  const counts = shell.overview?.counts;
  const selectSegment = (next: AssignmentSegment) => {
    if (next === segment) return;
    setLoading(true);
    setPage(1);
    setSearchParams(next === 'all' ? {} : { segment: next });
  };
  const refresh = () => { setLoading(true); setReload((value) => value + 1); shell.refresh(); };
  const empty = emptySegmentText(segment);

  return <div className="sp-page">
    <header className="sp-page-head">
      <div>
        <h1>Sự kiện được phân công</h1>
        <p>Xem thông tin sự kiện và ca trực cá nhân; lịch sử là dữ liệu chỉ đọc.</p>
      </div>
      <span className="sp-pill is-teal">{total} phân công</span>
    </header>

    <div className="sp-filters" role="toolbar" aria-label="Lọc phân công">
      {segments.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => selectSegment(item.value)}
          aria-pressed={segment === item.value}
          aria-label={`Lọc ${item.label}${counts ? `: ${counts[item.count]} phân công` : ''}`}
          className="sp-filter"
        >
          {item.label}
          {counts && <span className="sp-filter-count tb-num">{counts[item.count]}</span>}
        </button>
      ))}
    </div>

    {error && (
      <div className="sp-alert is-danger" role="alert">
        <span>{error}</span>
        <button type="button" className="sp-btn sp-btn--ghost sp-btn--sm" onClick={refresh}>Thử lại</button>
      </div>
    )}

    {loading ? (
      <p className="sp-loading" role="status">Đang tải danh sách phân công…</p>
    ) : events.length === 0 ? (
      <StaffEmptyState
        icon={CalendarCheck}
        title={empty.title}
        actions={<>
          <button type="button" className="sp-btn sp-btn--outline" onClick={refresh}><RefreshCw size={18} aria-hidden="true" />Làm mới danh sách</button>
          {segment !== 'all' && <button type="button" className="sp-btn sp-btn--ghost" onClick={() => selectSegment('all')}>Xem tất cả phân công</button>}
        </>}
      >
        <p>{empty.text}</p>
      </StaffEmptyState>
    ) : (
      <div className="sp-shift-grid">
        {events.map((event) => {
          const state = ASSIGNMENT_STATE[event.operationalState];
          const badge = dateBadge(event.startTime);
          const opensIn = event.operationalState === 'upcoming' || event.operationalState === 'preparing' ? countdownText(event.checkinStartAt, now) : null;
          return (
            <article key={event.assignmentId} className={`sp-shift is-${state.tone}`}>
              <div className="sp-shift-date" aria-hidden="true">
                <span>{badge.weekday}</span>
                <strong>{badge.day}</strong>
                <span>{badge.month}</span>
              </div>
              <div className="sp-shift-body">
                <span className={`sp-pill is-${state.tone}`}>{state.tone === 'live' && <span className="sp-dot" aria-hidden="true" />}{state.label}</span>
                <h3>{event.name}</h3>
                <p className="sp-meta"><Clock size={16} aria-hidden="true" />Cổng mở: {dayRange(event.checkinStartAt, event.checkinEndAt)}</p>
                <p className="sp-meta"><MapPin size={16} aria-hidden="true" />{event.venue}, {event.city}</p>
                {opensIn && <p className="sp-shift-countdown">Mở cổng sau {opensIn}</p>}
                <div className="sp-shift-actions">
                  <button type="button" onClick={() => setDetail(event)} className="sp-btn sp-btn--ghost sp-btn--sm"><Eye size={16} aria-hidden="true" />Chi tiết</button>
                  {event.operationalState === 'checkin_open' && (
                    <button type="button" onClick={() => navigate(`/staff/check-in?eventId=${event.eventId}`)} className="sp-btn sp-btn--primary sp-btn--sm"><ScanLine size={16} aria-hidden="true" />Vào cổng soát vé</button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    )}

    {pages > 1 && (
      <nav className="sp-pager" aria-label="Phân trang phân công">
        <button type="button" disabled={page === 1} onClick={() => { setLoading(true); setPage((value) => value - 1); }} className="sp-btn sp-btn--ghost sp-btn--sm"><ChevronLeft size={16} aria-hidden="true" />Trước</button>
        <span className="tb-num">Trang {page}/{pages}</span>
        <button type="button" disabled={page === pages} onClick={() => { setLoading(true); setPage((value) => value + 1); }} className="sp-btn sp-btn--ghost sp-btn--sm">Sau<ChevronRight size={16} aria-hidden="true" /></button>
      </nav>
    )}
    <StaffEventDetailDialog assignment={detail} onClose={() => setDetail(null)} />
  </div>;
}
