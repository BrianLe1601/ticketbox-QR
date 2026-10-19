import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Clock, Info, RefreshCw, ScanLine } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { EventScanner } from '@/components/checkin/EventScanner';
import { CameraCheck } from '@/components/staff/CameraCheck';
import { StaffEmptyState } from '@/components/staff/StaffEmptyState';
import { useNow } from '@/hooks/useNow';
import { useStaffShell } from '@/hooks/useStaffShell';
import { countdownText } from '@/lib/staff-portal';
import { getAssignedEvents } from '@/services/checkin.service';
import type { AssignedEvent } from '@/services/checkin.service';

const dayTime = (value: string) => new Date(value).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

export function StaffCheckinPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const shell = useStaffShell();
  const now = useNow(30_000);
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<AssignedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const selectedEventId = searchParams.get('eventId');

  useEffect(() => {
    const controller = new AbortController();
    getAssignedEvents(token, controller.signal)
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setEvents(data);
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Không thể tải danh sách sự kiện.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, reload]);

  useEffect(() => {
    const timer = window.setInterval(() => setReload((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const isEventOutOfWindow = Boolean(
    selectedEventId && !loading && events.length > 0 && !events.some((event) => String(event.id) === selectedEventId),
  );

  useEffect(() => {
    if (loading) return;
    if (events.length === 0) {
      if (selectedEventId) setSearchParams({}, { replace: true });
      return;
    }
    if (!selectedEventId || !events.some((event) => String(event.id) === selectedEventId)) {
      setSearchParams({ eventId: String(events[0]!.id) }, { replace: true });
    }
  }, [events, loading, selectedEventId, setSearchParams]);

  // This endpoint is server-filtered to Events currently inside the check-in window.
  const selectedEvent = events.find((e) => String(e.id) === selectedEventId) ?? events[0];
  const next = shell.overview?.nextUpcomingAssignment ?? null;
  const nextIn = next ? countdownText(next.checkinStartAt, now) : null;
  const recheck = () => { setLoading(true); setReload((value) => value + 1); shell.refresh(); };

  return (
    <div className="sp-page">
      <div className="sp-card sp-event-bar">
        <label className="sp-event-pick">
          <span><ScanLine size={20} aria-hidden="true" />Chọn sự kiện soát vé</span>
          <select
            value={selectedEvent ? String(selectedEvent.id) : ''}
            onChange={(e) => setSearchParams({ eventId: e.target.value })}
            disabled={events.length === 0}
          >
            {/* While loading say so: "no gate open" would be a claim the page cannot make yet. */}
            {events.length === 0 && <option value="">{loading ? "Đang tải sự kiện…" : "Không có sự kiện đang mở check-in"}</option>}
            {events.map((e) => (
              <option key={e.id} value={String(e.id)}>{e.name} ({e.venue})</option>
            ))}
          </select>
        </label>
        <span className={`sp-pill${events.length > 0 ? ' is-live' : ''}`}>
          {events.length > 0 ? <><span className="sp-dot" aria-hidden="true" />{events.length} sự kiện đang mở cổng</> : loading ? 'Đang kiểm tra…' : 'Chưa có cổng mở'}
        </span>
      </div>

      {isEventOutOfWindow && (
        <div className="sp-alert is-warning" role="status">
          Sự kiện trước đó đã đóng cổng hoặc kết thúc. Cổng soát vé đang chuyển sang sự kiện mở tiếp theo.
        </div>
      )}

      {error && (
        <div className="sp-alert is-danger" role="alert">
          <span>{error}</span>
          <button type="button" className="sp-btn sp-btn--ghost sp-btn--sm" onClick={recheck}>Thử lại</button>
        </div>
      )}

      {loading ? (
        <p className="sp-loading" role="status">Đang chuẩn bị máy quét…</p>
      ) : events.length === 0 ? (
        <div className="sp-standby">
          <StaffEmptyState
            icon={ScanLine}
            title="Không có sự kiện nào đang trong khung giờ check-in"
            actions={<>
              <button type="button" className="sp-btn sp-btn--outline" onClick={recheck}><RefreshCw size={18} aria-hidden="true" />Kiểm tra lại</button>
              <button type="button" className="sp-btn sp-btn--ghost" onClick={() => navigate('/staff/events?segment=upcoming')}><CalendarDays size={18} aria-hidden="true" />Xem ca trực sắp tới</button>
            </>}
          >
            <p className="sp-info-pill"><Info size={16} aria-hidden="true" />Cổng soát vé chỉ mở trong khung giờ check-in của sự kiện (bắt đầu sớm nhất 2 giờ trước giờ diễn, kết thúc khi đóng cổng).</p>
            {next && <p className="sp-empty-next"><Clock size={16} aria-hidden="true" />Ca kế tiếp: <strong>{next.name}</strong> · mở cổng {dayTime(next.checkinStartAt)}{nextIn ? ` (sau ${nextIn})` : ''}</p>}
          </StaffEmptyState>
          <div className="sp-card"><CameraCheck /></div>
        </div>
      ) : selectedEvent ? (
        <EventScanner key={selectedEvent.id} event={selectedEvent} token={token} />
      ) : null}
    </div>
  );
}
