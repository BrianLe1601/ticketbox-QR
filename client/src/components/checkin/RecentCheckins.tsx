import { RefreshCw } from 'lucide-react';
import type { CheckinLog } from '@/services/checkin.service';

interface RecentCheckinsProps {
  logs: CheckinLog[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
}

const resultLabels: Record<string, { label: string; tone: string }> = {
  SUCCESS: { label: 'Thành công', tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  ALREADY_CHECKED_IN: { label: 'Đã check-in', tone: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  WRONG_EVENT: { label: 'Sai sự kiện', tone: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  CANCELLED: { label: 'Vé đã hủy', tone: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  UNPAID: { label: 'Chưa thanh toán', tone: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  INVALID: { label: 'Không hợp lệ', tone: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  EVENT_NOT_AVAILABLE: { label: 'Ngoài giờ check-in', tone: 'bg-slate-700 text-slate-300 border-slate-600' },
  STAFF_NOT_ASSIGNED: { label: 'Chưa phân công', tone: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
};

export function RecentCheckins({ logs, loading, error, onRefresh }: RecentCheckinsProps) {
  const formatTime = (value: string) =>
    new Date(value).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-100">Lượt quét gần nhất</h3>
          <p className="text-xs text-slate-400">Tối đa 20 lượt quét gần nhất do chính bạn thực hiện tại sự kiện này</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-cyan-500/30 px-3 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300" role="alert">
          {error}
        </div>
      )}

      {loading && logs.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-400">Đang tải lịch sử soát vé...</p>
      ) : logs.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-400">Chưa có lượt quét nào tại cổng này.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const meta = resultLabels[log.code] ?? { label: log.code, tone: 'bg-slate-700 text-slate-300 border-slate-600' };
            return (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-slate-950/40 p-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className={`rounded-md border px-2 py-0.5 font-bold uppercase tracking-wider ${meta.tone}`}>
                    {meta.label}
                  </span>
                  <span className="font-mono text-slate-300">{log.scannedCode}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <span className="hidden sm:inline">{log.message}</span>
                  <span className="text-[11px]">{formatTime(log.checkedAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
