import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ScanLine } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { EventScanner } from '@/components/checkin/EventScanner';
import { getAssignedEvents } from '@/services/checkin.service';
import type { AssignedEvent } from '@/services/checkin.service';

export function StaffCheckinPage() {
  const { token } = useAuth();
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

  return (
    <div className="space-y-6">
      {/* Event Selector Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-900/60 p-4">
        <label className="flex w-full min-w-0 flex-col gap-2 text-sm font-semibold text-slate-200 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
          <span className="flex items-center gap-2"><ScanLine size={18} className="shrink-0 text-cyan-400" />Chọn sự kiện soát vé:</span>
          <select
            value={selectedEvent ? String(selectedEvent.id) : ''}
            onChange={(e) => setSearchParams({ eventId: e.target.value })}
            className="min-h-[40px] w-full min-w-0 rounded-lg border border-cyan-500/30 bg-slate-950 px-3 text-sm text-slate-100 focus-visible:outline-2 focus-visible:outline-cyan-300 sm:w-auto"
          >
            {events.length === 0 && <option value="">Không có sự kiện đang mở check-in</option>}
            {events.map((e) => (
              <option key={e.id} value={String(e.id)}>
                {e.name} ({e.venue})
              </option>
            ))}
          </select>
        </label>
        {events.length > 0 && (
          <span className="text-xs text-slate-400">
            Đang hiển thị {events.length} sự kiện đang được server cho phép soát vé
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400" role="status">Đang chuẩn bị máy quét...</p>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-8 text-center text-slate-400">
          <ScanLine size={40} className="mx-auto mb-3 text-slate-600" />
          <h3 className="text-base font-bold text-slate-200">Không có sự kiện nào đang trong khung giờ check-in</h3>
          <p className="mt-1 text-xs text-slate-400">
            Cổng soát vé chỉ mở trong khung giờ check-in quy định của sự kiện đã được công bố.
          </p>
        </div>
      ) : selectedEvent ? (
        <EventScanner key={selectedEvent.id} event={selectedEvent} token={token} />
      ) : null}
    </div>
  );
}
