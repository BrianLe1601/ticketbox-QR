import { Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { attendanceView } from '@/lib/staff-portal';
import { getGateAttendance, type GateAttendance } from '@/services/checkin.service';

/**
 * Gate-wide attendance of one open Event (every Staff member, not just this device), refreshed
 * after each scan (`refreshKey`) and every 30 seconds. Server counts only; nothing is guessed.
 */
export function GateAttendanceBar({ eventId, token, refreshKey = 0, compact = false }: { eventId: number; token: string | null; refreshKey?: number; compact?: boolean }) {
  const [value, setValue] = useState<GateAttendance | null>(null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((v) => v + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getGateAttendance(eventId, token, controller.signal)
      .then(({ data }) => { if (!controller.signal.aborted) { setValue(data); setError(false); } })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [eventId, token, refreshKey, tick]);

  const view = attendanceView(value);
  if (!view) {
    // Same three rows as the loaded bar, so the block below does not move when the counts arrive.
    return (
      <div className={`sp-attend is-pending${compact ? ' is-compact' : ''}`} role="status">
        <div className="sp-attend-head">
          <span className="sp-attend-label"><Users size={16} aria-hidden="true" />Toàn cổng</span>
          <strong>{error ? 'Chưa tải được' : 'Đang tải…'}</strong>
        </div>
        <div className="sp-progress is-attend" aria-hidden="true"><span style={{ transform: 'scaleX(0)' }} /></div>
        <span className="sp-attend-sub">{error ? 'Số vé đã vào sẽ hiện khi máy chủ trả lời.' : 'Đang lấy số vé đã vào…'}</span>
      </div>
    );
  }
  return (
    <div className={`sp-attend${compact ? ' is-compact' : ''}`}>
      <div className="sp-attend-head">
        <span className="sp-attend-label"><Users size={16} aria-hidden="true" />Toàn cổng</span>
        <strong className="tb-num">{view.text}</strong>
      </div>
      <div className="sp-progress is-attend" role="progressbar" aria-label={`${view.text}, ${view.remaining}`}
        aria-valuemin={0} aria-valuemax={value?.validTickets ?? 0} aria-valuenow={value?.admitted ?? 0}>
        <span style={{ transform: `scaleX(${view.share})` }} />
      </div>
      <span className="sp-attend-sub tb-num">{view.remaining}</span>
    </div>
  );
}
