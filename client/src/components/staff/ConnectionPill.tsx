import { Wifi, WifiOff } from 'lucide-react';

import { clockText } from '@/lib/staff-portal';

/**
 * Honest connection state: the browser's online flag plus the last time the shift data answered.
 * It does not claim instant sync; Staff data is refreshed every 30 seconds.
 */
export function ConnectionPill({ online, lastSyncAt, failing }: { online: boolean; lastSyncAt: Date | null; failing: boolean }) {
  const offline = !online;
  const tone = offline ? 'is-offline' : failing ? 'is-warning' : 'is-online';
  const label = offline ? 'Mất kết nối' : failing ? 'Máy chủ chưa phản hồi' : 'Trực tuyến';
  const detail = lastSyncAt ? `Cập nhật ${clockText(lastSyncAt)}` : 'Đang đồng bộ…';
  return (
    <span className={`sp-conn ${tone}`} role="status" aria-live="polite" title={`${label} · ${detail} · tự cập nhật 30 giây/lần`}>
      {offline ? <WifiOff size={14} aria-hidden="true" /> : <Wifi size={14} aria-hidden="true" />}
      <span className="sp-conn-label">{label}</span>
      <span className="sp-conn-detail tb-num">· {detail}</span>
    </span>
  );
}
