import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { CHECKIN_LABELS, scanVerdict } from '@/components/checkin/scan-verdict';
import type { CheckinLog } from '@/services/checkin.service';

interface RecentCheckinsProps {
  logs: CheckinLog[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
}

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** The last scans this Staff member made at this gate (server, up to 20); 5 shown until expanded. */
export function RecentCheckins({ logs, loading, error, onRefresh }: RecentCheckinsProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? logs : logs.slice(0, 5);

  return (
    <section className="sp-card sp-recent" aria-labelledby="sp-recent-title">
      <header className="sp-recent-head">
        <div>
          <h3 id="sp-recent-title">Lượt quét gần nhất</h3>
          <p>Của chính bạn tại cổng này</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} className="sp-btn sp-btn--ghost sp-btn--sm">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />Làm mới
        </button>
      </header>

      {error && <p className="sp-alert is-danger" role="alert">{error}</p>}

      {loading && logs.length === 0 ? (
        <p className="sp-loading" role="status">Đang tải lượt quét…</p>
      ) : logs.length === 0 ? (
        <p className="sp-recent-empty">Chưa có lượt quét nào tại cổng này.</p>
      ) : (
        <ul className="sp-recent-list">
          {shown.map((log) => {
            const tone = scanVerdict(log.code).tone;
            return (
              <li key={log.id} className={`sp-recent-row is-${tone}`}>
                <span className={`sp-status is-${tone}`}>{CHECKIN_LABELS[log.code] ?? log.code}</span>
                <span className="sp-recent-code tb-mono">{log.scannedCode}</span>
                <time className="tb-num" dateTime={log.checkedAt}>{formatTime(log.checkedAt)}</time>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="sp-recent-foot">
        {logs.length > 5 && (
          <button type="button" className="sp-link" onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Thu gọn' : `Hiện cả ${logs.length} lượt`}
          </button>
        )}
        <Link to="/staff/history" className="sp-link">Xem toàn bộ lịch sử</Link>
      </footer>
    </section>
  );
}
