import { useCallback, useEffect, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { CameraScanner } from '@/components/checkin/CameraScanner';
import { getAssignedEvents, getRecentCheckins, submitCheckin } from '@/services/checkin.service';
import type { AssignedEvent, CheckinLog, CheckinResult } from '@/services/checkin.service';

const button = 'rounded-lg border border-cyan-400/30 px-4 py-2 text-sm hover:bg-cyan-400/10 focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50';
const formatTime = (value: string) => new Date(value).toLocaleString('vi-VN');
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : 'Không thể kết nối máy chủ.';

function EventScanner({ event, token }: { event: AssignedEvent; token: string | null }) {
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
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    getRecentCheckins(event.id, token, controller.signal).then(({ data }) => {
      if (!controller.signal.aborted) { setLogs(data); setLogError(''); }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setLogError(errorMessage(cause));
    }).finally(() => { if (!controller.signal.aborted) setLogsLoading(false); });
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
      if (mounted.current) setError(`${errorMessage(cause)} Nếu kết nối bị ngắt, hãy kiểm tra lịch sử trước khi thử lại.`);
    } finally {
      if (mounted.current) {
        setPending(false);
        setRefresh((value) => value + 1);
      }
      // Explicit “next ticket” is required even after a network error.
    }
  }, [event.id, token]);
  const detected = useCallback((value: string) => { void scan(value); }, [scan]);

  return <section className="mt-6 space-y-5 rounded-2xl border border-cyan-400/20 bg-[#081727]/90 p-5">
    <div><h2 className="text-xl font-bold">{event.name}</h2>
      <p className="text-sm text-slate-300">{event.venue}</p>
      <p className="mt-1 text-sm text-slate-400">Giờ check-in: {formatTime(event.checkinStartAt)} – {formatTime(event.checkinEndAt)}</p>
    </div>
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void scan(code); }}>
      <label htmlFor="ticket-code" className="block font-medium">Mã vé hoặc nội dung QR</label>
      <input ref={input} id="ticket-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={512}
        disabled={paused || camera} required autoComplete="off" placeholder="TKT-…"
        className="w-full rounded-lg border border-slate-600 bg-slate-950 px-4 py-3 focus:border-cyan-300 focus:outline-none disabled:opacity-50" />
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={button} disabled={paused || camera || !code.trim()}>{pending ? 'Đang kiểm tra…' : 'Check-in vé'}</button>
        <button type="button" className={button} disabled={paused || camera} onClick={() => setCamera(true)}>Quét bằng camera</button>
      </div>
    </form>
    {camera && <CameraScanner onDetected={detected} onClose={closeCamera} />}
    {pending && <p role="status">Đang xác nhận vé, vui lòng chờ…</p>}
    {result && <div role="status" aria-live="polite" className={`rounded-xl border p-4 ${result.code === 'SUCCESS' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-amber-400/40 bg-amber-400/10 text-amber-200'}`}>
      <h3 className="font-bold">{result.message}</h3>
      {result.ticket && <p className="mt-2">{result.ticket.code} · {result.ticket.holderName ?? 'Người tham dự'}
        {result.ticket.checkedInAt && ` · Đã vào lúc ${formatTime(result.ticket.checkedInAt)}`}</p>}
    </div>}
    {error && <p role="alert" className="rounded-lg border border-red-400/40 p-4 text-red-200">{error}</p>}
    {paused && <button type="button" className={button} disabled={pending} onClick={() => {
      requestLock.current = false; setPaused(false); setResult(null); setError(''); setCode('');
      requestAnimationFrame(() => input.current?.focus());
    }}>Vé tiếp theo</button>}
    <div className="border-t border-slate-700 pt-5">
      <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-semibold">20 lần quét gần nhất của bạn</h3>
        <button type="button" className={button} disabled={logsLoading} onClick={() => { setLogsLoading(true); setRefresh((value) => value + 1); }}>Tải lại</button></div>
      {logsLoading && <p role="status">Đang tải lịch sử…</p>}
      {logError && <p role="alert" className="text-amber-300">{logError}</p>}
      {!logsLoading && !logError && logs.length === 0 && <p className="text-slate-400">Chưa có lần quét nào tại sự kiện này.</p>}
      {!logError && <ul className="space-y-2">{logs.map((log) => <li key={log.id} className="rounded-lg bg-white/5 p-3 text-sm">
        <span className={log.code === 'SUCCESS' ? 'text-emerald-300' : 'text-amber-300'}>{log.message}</span>
        <p className="mt-1 text-slate-400">{formatTime(log.checkedAt)} · {log.scannedCode}</p>
      </li>)}</ul>}
    </div>
  </section>;
}

export function StaffHomePage() {
  const { token } = useAuth();
  const [events, setEvents] = useState<AssignedEvent[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getAssignedEvents(token, controller.signal).then(({ data }) => {
      if (!controller.signal.aborted) { setEvents(data); setError(''); }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(errorMessage(cause));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, reload]);
  const selected = events.find((event) => String(event.id) === selectedId);
  return <div>
    <h1 className="flex items-center gap-3 text-2xl font-bold"><ScanLine className="text-cyan-300" />Check-in sự kiện</h1>
    <p className="mt-2 text-slate-400">Chọn sự kiện được phân công để kiểm tra vé tại cổng.</p>
    <button className={`${button} mt-4`} disabled={loading} onClick={() => { setLoading(true); setSelectedId(''); setReload((value) => value + 1); }}>Tải lại sự kiện</button>
    {loading && <p role="status" className="mt-4">Đang tải sự kiện…</p>}
    {error && <p role="alert" className="mt-4 text-amber-300">{error}</p>}
    {!loading && !error && events.length === 0 && <p className="mt-5 rounded-xl border border-slate-700 p-6">Bạn chưa được phân công sự kiện nào. Hãy liên hệ quản trị viên.</p>}
    {!loading && !error && events.length > 0 && <div className="mt-5">
      <label htmlFor="staff-event" className="mb-2 block font-medium">Sự kiện được phân công</label>
      <select id="staff-event" className="w-full rounded-lg border border-slate-600 bg-slate-950 p-3 focus:outline-2 focus:outline-cyan-300" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
        <option value="">Chọn sự kiện</option>
        {events.map((event) => <option key={event.id} value={event.id}>{event.name} · {formatTime(event.startTime)}</option>)}
      </select>
      {selected && <EventScanner key={selected.id} event={selected} token={token} />}
    </div>}
  </div>;
}
