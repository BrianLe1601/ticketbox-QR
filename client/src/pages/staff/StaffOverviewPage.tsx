import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarClock, CalendarDays, ClipboardList, Clock, History, MapPin, RadioTower, RefreshCw, ScanLine, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { GateAttendanceBar } from '@/components/staff/GateAttendanceBar';
import { StaffEmptyState } from '@/components/staff/StaffEmptyState';
import { useNow } from '@/hooks/useNow';
import { useStaffShell } from '@/hooks/useStaffShell';
import { clockText, countdownText, timeText } from '@/lib/staff-portal';

const dayTime = (value: string) => new Date(value).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

function LiveClock() {
  const now = useNow(1000);
  return <time className="sp-hero-clock" dateTime={now.toISOString()} aria-label={`Giờ hiện tại ${clockText(now)}`}>{clockText(now)}</time>;
}

export function StaffOverviewPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { overview, loading, error, refresh } = useStaffShell();
  const now = useNow(30_000);
  const counts = overview?.counts ?? { total: 0, open: 0, upcoming: 0, history: 0 };
  const openEvents = overview?.openEvents ?? [];
  const next = overview?.nextUpcomingAssignment ?? null;
  const nextIn = next ? countdownText(next.checkinStartAt, now) : null;
  const firstOpen = openEvents[0];

  const kpis = [
    { label: 'Tổng phân công', value: counts.total, hint: 'Tất cả sự kiện được giao', icon: ClipboardList, tone: 'teal', to: '/staff/events' },
    { label: 'Cổng đang mở', value: counts.open, hint: counts.open > 0 ? 'Sẵn sàng quét mã QR' : 'Chưa có cổng mở', icon: RadioTower, tone: 'live', to: '/staff/check-in', live: counts.open > 0 },
    { label: 'Sắp tới / chuẩn bị', value: counts.upcoming, hint: 'Ca trực chưa tới giờ mở cổng', icon: CalendarClock, tone: 'info', to: '/staff/events?segment=upcoming' },
    { label: 'Ca đã kết thúc', value: counts.history, hint: 'Đã đóng cổng, kết thúc hoặc thu hồi', icon: History, tone: 'muted', to: '/staff/events?segment=history' },
  ] as const;

  return (
    <div className="sp-page">
      <section className="sp-hero" aria-labelledby="sp-hero-title">
        <div className="sp-hero-main">
          <span className="sp-hero-eyebrow"><span className="sp-dot" aria-hidden="true" />Không gian vận hành nhân viên</span>
          <h1 id="sp-hero-title">Xin chào, {user?.fullName ?? 'Nhân viên'}</h1>
          <p>Theo dõi phân công ca trực và vận hành cổng soát vé tại địa điểm tổ chức.</p>
        </div>
        <div className="sp-hero-side">
          <LiveClock />
          {firstOpen ? (
            <button type="button" className="sp-hero-cta" onClick={() => navigate(`/staff/check-in?eventId=${firstOpen.eventId}`)}>
              <ScanLine size={20} aria-hidden="true" />Mở máy quét ngay<ArrowRight size={18} aria-hidden="true" />
            </button>
          ) : (
            <p className="sp-hero-next">
              {next && nextIn ? <>Ca kế tiếp mở cổng sau <strong>{nextIn}</strong></> : 'Chưa có cổng nào đang mở'}
            </p>
          )}
        </div>
      </section>

      <div className="sp-kpis">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              type="button"
              className={`sp-kpi sp-kpi--${kpi.tone}${'live' in kpi && kpi.live ? ' is-live' : ''}`}
              onClick={() => navigate(kpi.to)}
              aria-label={`${kpi.label}: ${kpi.value}. Xem chi tiết`}
            >
              <span className="sp-kpi-head">
                <span className="sp-kpi-label">{kpi.label}</span>
                <span className="sp-kpi-icon" aria-hidden="true"><Icon size={20} /></span>
              </span>
              <strong className="sp-kpi-value">{loading && !overview ? '—' : kpi.value}</strong>
              <span className="sp-kpi-hint">{kpi.hint}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="sp-alert is-danger" role="alert">
          <span>{error}</span>
          <button type="button" className="sp-btn sp-btn--ghost sp-btn--sm" onClick={refresh}>Thử lại</button>
        </div>
      )}

      <section className="sp-section" aria-labelledby="sp-open-title">
        <header className="sp-section-head">
          <div>
            <h2 id="sp-open-title">Cổng check-in đang hoạt động</h2>
            <p>Chỉ hiện sự kiện bạn được phân công và đang trong khung giờ check-in.</p>
          </div>
          <button type="button" className="sp-btn sp-btn--ghost sp-btn--sm" onClick={refresh} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />Làm mới
          </button>
        </header>

        {loading && !overview ? (
          <p className="sp-loading" role="status">Đang tải dữ liệu ca trực…</p>
        ) : openEvents.length === 0 ? (
          <StaffEmptyState
            icon={ScanLine}
            title="Hiện chưa có sự kiện nào trong khung giờ mở cổng"
            actions={<>
              <button type="button" className="sp-btn sp-btn--outline" onClick={refresh} disabled={loading}><RefreshCw size={18} aria-hidden="true" />Kiểm tra lại phân công</button>
              <button type="button" className="sp-btn sp-btn--ghost" onClick={() => navigate('/staff/events?segment=upcoming')}><CalendarDays size={18} aria-hidden="true" />Xem ca trực sắp tới</button>
            </>}
          >
            <p>Cổng soát vé tự mở theo khung giờ check-in Quản trị viên đặt cho từng sự kiện (sớm nhất 2 giờ trước giờ diễn) và đóng khi hết khung giờ.</p>
            {next && <p className="sp-empty-next"><Clock size={16} aria-hidden="true" />Ca kế tiếp: <strong>{next.name}</strong> · mở cổng {dayTime(next.checkinStartAt)}{nextIn ? ` (sau ${nextIn})` : ''}</p>}
          </StaffEmptyState>
        ) : (
          <div className="sp-open-grid">
            {openEvents.map((event) => {
              const closesIn = countdownText(event.checkinEndAt, now);
              return (
                <article key={event.assignmentId} className="sp-open-card">
                  <div className="sp-open-top">
                    <span className="sp-pill is-live"><span className="sp-dot" aria-hidden="true" />Đang mở cổng</span>
                    <span className="sp-open-closes">{closesIn ? `Đóng sau ${closesIn}` : 'Sắp đóng'}</span>
                  </div>
                  <h3>{event.name}</h3>
                  <p className="sp-meta"><MapPin size={16} aria-hidden="true" />{event.venue} · {event.city}</p>
                  <p className="sp-meta"><Clock size={16} aria-hidden="true" />Cổng {timeText(event.checkinStartAt)} – {timeText(event.checkinEndAt)}</p>
                  <GateAttendanceBar eventId={event.eventId} token={token} compact />
                  <button type="button" className="sp-btn sp-btn--primary sp-btn--block" onClick={() => navigate(`/staff/check-in?eventId=${event.eventId}`)}>
                    <ScanLine size={18} aria-hidden="true" />Vào cổng soát vé<ArrowRight size={16} aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {next && openEvents.length > 0 && (
        <section className="sp-next" aria-label="Ca trực kế tiếp">
          <CalendarClock size={22} aria-hidden="true" />
          <div>
            <strong>{next.operationalState === 'preparing' ? 'Sự kiện đang chuẩn bị' : 'Ca trực kế tiếp'}: {next.name}</strong>
            <span>Mở cổng {dayTime(next.checkinStartAt)}{nextIn ? ` · sau ${nextIn}` : ''} · {next.venue}</span>
          </div>
          <button type="button" className="sp-btn sp-btn--ghost sp-btn--sm" onClick={() => navigate('/staff/events?segment=upcoming')}>Xem phân công</button>
        </section>
      )}

      <p className="sp-footnote"><ShieldCheck size={16} aria-hidden="true" />Mỗi lượt quét vẫn được máy chủ kiểm tra theo phân công, khung giờ và trạng thái vé.</p>
    </div>
  );
}
