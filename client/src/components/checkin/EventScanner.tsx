import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, AlertTriangle, Camera, CheckCircle2, Clock3, Keyboard, Maximize2, MapPin, Minimize2, ScanLine, Smartphone, Sun, Volume2, VolumeX, WifiOff, XCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { CameraScanner } from '@/components/checkin/CameraScanner';
import { RecentCheckins } from '@/components/checkin/RecentCheckins';
import { gateWindow, scanVerdict } from '@/components/checkin/scan-verdict';
import { GateAttendanceBar } from '@/components/staff/GateAttendanceBar';
import { useNow } from '@/hooks/useNow';
import { useStaffShell } from '@/hooks/useStaffShell';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useScanFeedback } from '@/hooks/useScanFeedback';
import { clockText, countdownText, sessionTally } from '@/lib/staff-portal';
import { getRecentCheckins, submitCheckin } from '@/services/checkin.service';
import type { AssignedEvent, CheckinLog, CheckinResult } from '@/services/checkin.service';

interface EventScannerProps {
  event: AssignedEvent;
  token: string | null;
}

const VERDICT_ICON = { success: CheckCircle2, warning: AlertTriangle, failed: XCircle } as const;

export function EventScanner({ event, token }: EventScannerProps) {
  const { user } = useAuth();
  const feedback = useScanFeedback(user?.id ?? 0);
  const now = useNow(15_000);
  // Offline: every scan needs the server, so scanning is paused rather than guessed (never let in blind).
  const { online } = useStaffShell();
  const wake = useWakeLock(feedback.prefs.keepAwake);
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
  const [autoCamera, setAutoCamera] = useState(true);
  const [session, setSession] = useState<Array<{ at: number; allowed: boolean }>>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const cameraWasActiveRef = useRef(false);
  const requestLock = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const mounted = useRef(true);
  const canFullscreen = typeof document !== 'undefined' && typeof document.documentElement.requestFullscreen === 'function';

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

  useEffect(() => {
    const root = rootRef.current;
    const onChange = () => setFullscreen(Boolean(root) && document.fullscreenElement === root);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (root && document.fullscreenElement === root) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void rootRef.current?.requestFullscreen().catch(() => {});
  }, []);

  const closeCamera = useCallback(() => {
    cameraWasActiveRef.current = false;
    setCamera(false);
  }, []);

  const toggleCamera = useCallback(() => {
    feedback.unlock();
    setCamera((prev) => {
      const next = !prev;
      cameraWasActiveRef.current = next;
      return next;
    });
  }, [feedback]);

  const { play } = feedback;
  const scan = useCallback(async (value: string) => {
    if (requestLock.current || !value.trim() || !navigator.onLine) return;
    requestLock.current = true;
    setCamera(false);
    setPending(true);
    setPaused(true);
    setResult(null);
    setError('');
    try {
      const { data } = await submitCheckin(event.id, value.trim(), token);
      if (mounted.current) {
        setResult(data);
        const verdict = scanVerdict(data.code);
        play(verdict.tone);
        setSession((list) => [...list, { at: Date.now(), allowed: verdict.allow }]);
      }
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : 'Lỗi kết nối máy chủ. Kiểm tra lại lịch sử.');
        play('failed');
      }
    } finally {
      if (mounted.current) {
        setPending(false);
        setRefresh((v) => v + 1);
      }
    }
  }, [event.id, token, play]);

  const resetForNext = useCallback(() => {
    requestLock.current = false;
    setPaused(false);
    setResult(null);
    setError('');
    setCode('');
    if (autoCamera && cameraWasActiveRef.current) {
      setCamera(true);
    } else {
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [autoCamera]);

  const focusManual = useCallback(() => {
    cameraWasActiveRef.current = false;
    setCamera(false);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!paused || pending) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        resetForNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paused, pending, resetForNext]);

  const verdict = scanVerdict(result?.code);
  const VerdictIcon = VERDICT_ICON[verdict.tone];
  const tally = sessionTally(session, now.getTime());
  const closesIn = countdownText(event.checkinEndAt, now);
  const resultTone = !paused ? 'idle' : pending ? 'pending' : verdict.tone;

  // Single-column layouts put the verdict above the input once a scan starts; bring it into view.
  useEffect(() => {
    if (!paused || !resultRef.current || !window.matchMedia('(max-width: 1100px)').matches) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resultRef.current.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }, [paused]);

  return (
    <div ref={rootRef} className={`sp-terminal${fullscreen ? ' is-fullscreen' : ''}${paused ? ' is-paused' : ''}`}>
      {/* The Event being worked and its gate window stay visible above every scan. */}
      <header className="sp-term-context" aria-label={`Cổng soát vé ${event.name}`}>
        <div className="sp-term-event">
          <span className="sp-pill is-live"><span className="sp-dot" aria-hidden="true" />Cổng đang mở</span>
          <h2>{event.name}</h2>
          <p className="sp-term-meta">
            <span><MapPin size={16} aria-hidden="true" />{event.venue}</span>
            <span><Clock3 size={16} aria-hidden="true" />Cổng {gateWindow(event.checkinStartAt, event.checkinEndAt)}{closesIn ? ` · đóng sau ${closesIn}` : ''}</span>
          </p>
          <GateAttendanceBar eventId={event.id} token={token} refreshKey={refresh} />
        </div>
        <div className="sp-term-tools" role="group" aria-label="Tiện ích tại cổng">
          <button type="button" className={`sp-toggle${feedback.prefs.sound ? ' is-on' : ''}`} aria-pressed={feedback.prefs.sound}
            onClick={() => { feedback.update({ sound: !feedback.prefs.sound }); }}>
            {feedback.prefs.sound ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
            Âm báo: {feedback.prefs.sound ? 'Bật' : 'Tắt'}
          </button>
          {feedback.canVibrate && (
            <button type="button" className={`sp-toggle${feedback.prefs.vibrate ? ' is-on' : ''}`} aria-pressed={feedback.prefs.vibrate}
              onClick={() => feedback.update({ vibrate: !feedback.prefs.vibrate })}>
              <Smartphone size={18} aria-hidden="true" />Rung: {feedback.prefs.vibrate ? 'Bật' : 'Tắt'}
            </button>
          )}
          <button type="button" className={`sp-toggle${wake.active ? ' is-on' : ''}`} aria-pressed={feedback.prefs.keepAwake}
            disabled={!wake.supported}
            title={wake.supported ? 'Giữ màn hình không tự tắt khi đang ở cổng (tốn pin hơn)' : 'Trình duyệt này không hỗ trợ giữ màn hình sáng; hãy chỉnh thời gian tắt màn hình trong cài đặt máy'}
            onClick={() => feedback.update({ keepAwake: !feedback.prefs.keepAwake })}>
            <Sun size={18} aria-hidden="true" />Giữ màn hình sáng: {!wake.supported ? 'Không hỗ trợ' : feedback.prefs.keepAwake ? 'Bật' : 'Tắt'}
          </button>
          <button type="button" className="sp-toggle" onClick={focusManual} disabled={pending || paused || !online}>
            <Keyboard size={18} aria-hidden="true" />Nhập mã tay
          </button>
          {canFullscreen && (
            <button type="button" className="sp-toggle" onClick={toggleFullscreen} aria-pressed={fullscreen}>
              {fullscreen ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
              {fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            </button>
          )}
        </div>
      </header>

      {wake.error && <p className="sp-alert is-warning" role="status">{wake.error}</p>}
      {!online && (
        <p className="sp-alert is-danger sp-offline" role="alert">
          <WifiOff size={20} aria-hidden="true" />
          <span><strong>Mất kết nối — tạm dừng soát vé.</strong> Mỗi vé phải được máy chủ xác nhận; chờ có mạng rồi quét lại và không cho khách vào khi chưa có kết quả.</span>
        </p>
      )}

      <div className="sp-term-grid">
        <section className="sp-card sp-term-input" aria-label="Quét hoặc nhập mã vé">
          {camera && online ? (
            <CameraScanner onDetected={(v: string) => { cameraWasActiveRef.current = true; void scan(v); }} onClose={closeCamera} />
          ) : (
            <button type="button" onClick={toggleCamera} disabled={pending || paused || !online} className="sp-cam-start">
              <span className="sp-cam-start-icon" aria-hidden="true"><Camera size={30} /></span>
              <strong>Bật camera quét QR</strong>
              <span>Đưa mã QR trên vé điện tử vào khung hình; kết quả hiện ngay bên cạnh.</span>
            </button>
          )}

          {/* Manual code entry is always available as the fallback for a QR that will not scan. */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              feedback.unlock();
              if (code.trim()) {
                cameraWasActiveRef.current = false;
                void scan(code);
              }
            }}
            className="sp-manual"
          >
            <label htmlFor="sp-manual-code">Nhập mã vé dự phòng</label>
            <div className="sp-manual-row">
              <input
                id="sp-manual-code"
                ref={inputRef}
                type="text"
                value={code}
                disabled={pending || paused || !online}
                onChange={(e) => setCode(e.target.value)}
                maxLength={512}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="Mã vé (TKT-…) hoặc nội dung QR"
              />
              <button type="submit" disabled={pending || paused || !code.trim() || !online} className="sp-btn sp-btn--primary">
                {pending ? 'Đang kiểm tra…' : !online ? 'Chờ có mạng để quét' : 'Xác thực vé'}
              </button>
            </div>
            <p className="sp-manual-hint">Dùng khi màn hình điện thoại của khách bị nứt, mờ hoặc camera không đọc được QR.</p>
          </form>

          <label className="sp-check">
            <input type="checkbox" checked={autoCamera} onChange={(e) => setAutoCamera(e.target.checked)} />
            <span>Tự động mở lại camera khi quét vé tiếp theo</span>
          </label>
        </section>

        <div className="sp-term-side">
          {/* Verdict in words first; colour, icon, sound and vibration only reinforce it. */}
          <section ref={resultRef} className={`sp-result is-${resultTone}`} role="status" aria-live="assertive" aria-label="Kết quả soát vé">
            {resultTone === 'idle' ? (
              online ? (
                <div className="sp-result-idle">
                  <ScanLine size={40} aria-hidden="true" />
                  <strong>SẴN SÀNG SOÁT VÉ</strong>
                  <span>Quét mã QR hoặc nhập mã vé. Chỉ cho khách vào khi màn hình ghi <b>CHO VÀO</b>.</span>
                </div>
              ) : (
                <div className="sp-result-idle is-offline">
                  <WifiOff size={40} aria-hidden="true" />
                  <strong>TẠM DỪNG SOÁT VÉ</strong>
                  <span>Mất kết nối tới máy chủ. Chưa cho khách vào; quét lại khi có mạng.</span>
                </div>
              )
            ) : (
              <>
                <div className="sp-result-verdict">
                  {pending ? <Clock3 size={52} aria-hidden="true" /> : <VerdictIcon size={52} aria-hidden="true" />}
                  <span className="sp-result-label">{pending ? 'ĐANG KIỂM TRA VÉ…' : verdict.label}</span>
                </div>
                <p className="sp-result-message">{pending ? 'Vui lòng chờ, chưa cho khách vào.' : result?.message ?? error}</p>
                {!pending && result?.ticket && (
                  <dl className="sp-result-facts">
                    <div><dt>Mã vé</dt><dd className="tb-mono">{result.ticket.code}</dd></div>
                    {result.ticket.ticketTypeName && <div className="is-tier"><dt>Hạng vé</dt><dd>{result.ticket.ticketTypeName}</dd></div>}
                    {result.ticket.holderName && <div><dt>Khách</dt><dd>{result.ticket.holderName}</dd></div>}
                    {result.ticket.checkedInAt && (
                      <div><dt>{result.code === 'SUCCESS' ? 'Vào lúc' : 'Đã vào lúc'}</dt><dd className="tb-num">{clockText(new Date(result.ticket.checkedInAt))}</dd></div>
                    )}
                  </dl>
                )}
                {!pending && !result && (
                  <p className="sp-result-message">Không nhận được kết quả. Đừng cho khách vào; kiểm tra lượt quét gần nhất rồi quét lại.</p>
                )}
                {!pending && (
                  <button type="button" onClick={resetForNext} autoFocus className="sp-btn sp-btn--next">
                    Vé tiếp theo (Enter)<ArrowRight size={20} aria-hidden="true" />
                  </button>
                )}
              </>
            )}
          </section>

          <section className="sp-card sp-tally" aria-label="Phiên quét trên thiết bị này">
            <div><span>Phiên này</span><strong className="tb-num">{tally.total}</strong></div>
            <div className="is-ok"><span>Cho vào</span><strong className="tb-num">{tally.allowed}</strong></div>
            <div className="is-bad"><span>Từ chối</span><strong className="tb-num">{tally.refused}</strong></div>
            <div title="Trung bình 5 phút gần nhất trên thiết bị này"><span>Lượt/phút</span><strong className="tb-num">{tally.perMinute}</strong></div>
          </section>

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
      </div>
    </div>
  );
}
