import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { CameraScanner } from '@/components/checkin/CameraScanner';
import { RecentCheckins } from '@/components/checkin/RecentCheckins';
import { getRecentCheckins, submitCheckin } from '@/services/checkin.service';
import type { AssignedEvent, CheckinLog, CheckinResult } from '@/services/checkin.service';

interface EventScannerProps {
  event: AssignedEvent;
  token: string | null;
}

export function EventScanner({ event, token }: EventScannerProps) {
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [camera, setCamera] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<CheckinLog[]>([]);
  const [logError, setLogError] = useState('');
  const [logsLoading, setLogsLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const requestLock = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getRecentCheckins(event.id, token, controller.signal)
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setLogs(data);
          setLogError('');
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setLogError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử soát vé.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLogsLoading(false);
      });
    return () => controller.abort();
  }, [event.id, token, refresh]);

  const closeCamera = useCallback(() => setCamera(false), []);

  const scan = useCallback(async (value: string) => {
    if (requestLock.current || !value.trim()) return;
    requestLock.current = true;
    setCamera(false);
    setPending(true);
    setPaused(true);
    setResult(null);
    setError('');
    try {
      const { data } = await submitCheckin(event.id, value.trim(), token);
      if (mounted.current) setResult(data);
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : 'Lỗi kết nối máy chủ. Kiểm tra lại lịch sử.');
      }
    } finally {
      if (mounted.current) {
        setPending(false);
        setRefresh((v) => v + 1);
      }
    }
  }, [event.id, token]);

  const resetForNext = useCallback(() => {
    requestLock.current = false;
    setPaused(false);
    setResult(null);
    setError('');
    setCode('');
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  return (
    <div className="space-y-6">
      {/* Scanner Control Deck */}
      <section className="space-y-4 rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Cổng soát vé đang hoạt động</span>
            <h2 className="text-xl font-bold text-slate-100">{event.name}</h2>
            <p className="text-xs text-slate-400">{event.venue}</p>
          </div>
          <button
            type="button"
            onClick={() => setCamera((v) => !v)}
            disabled={pending || paused}
            aria-pressed={camera}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-950/40 px-4 text-sm font-bold text-cyan-300 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {camera ? <CameraOff size={18} /> : <Camera size={18} />}
            <span>{camera ? 'Tắt camera' : 'Bật camera quét QR'}</span>
          </button>
        </div>

        {camera && (
          <div className="overflow-hidden rounded-xl border border-cyan-500/40 bg-black p-2">
            <CameraScanner onDetected={(v: string) => void scan(v)} onClose={closeCamera} />
          </div>
        )}

        {/* Manual Code Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) void scan(code);
          }}
          className="flex flex-wrap gap-2 sm:flex-nowrap"
        >
          <input
            ref={inputRef}
            type="text"
            aria-label="Mã vé hoặc nội dung QR"
            value={code}
            disabled={pending || paused}
            onChange={(e) => setCode(e.target.value)}
            maxLength={512}
            autoComplete="off"
            placeholder="Nhập mã vé hoặc quét mã vạch/QR..."
            className="min-h-[44px] flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={pending || paused || !code.trim()}
            className="flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-6 text-sm font-bold text-white hover:from-cyan-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Đang kiểm tra...' : 'Xác nhận vé'}
          </button>
        </form>

        {/* Result & Explicit Next Ticket Step */}
        {paused && (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-xl border p-4 transition-all ${
              result?.code === 'SUCCESS'
                ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                : 'border-amber-500/40 bg-amber-950/30 text-amber-300'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {result?.code === 'SUCCESS' ? (
                  <CheckCircle2 size={24} className="text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertTriangle size={24} className="text-amber-400 flex-shrink-0" />
                )}
                <div>
                  <strong className="block text-base font-bold">
                    {pending ? 'Đang xác thực vé, vui lòng chờ…' : result?.message ?? error}
                  </strong>
                  {result?.ticket && (
                    <span className="text-xs text-slate-300">
                      Mã: <b>{result.ticket.code}</b> {result.ticket.holderName ? `· Người sở hữu: ${result.ticket.holderName}` : ''}
                    </span>
                  )}
                </div>
              </div>
              {!pending && (
                <button
                  type="button"
                  onClick={resetForNext}
                  autoFocus
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-slate-950 shadow-md hover:bg-slate-200"
                >
                  <span>Vé tiếp theo</span>
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Recent Check-in Logs Component */}
      <RecentCheckins
        logs={logs}
        loading={logsLoading}
        error={logError}
        onRefresh={() => {
          setLogsLoading(true);
          setRefresh((v) => v + 1);
        }}
      />
    </div>
  );
}
