import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { getStaffOverview, type StaffOverview } from '@/services/checkin.service';

export interface StaffShell {
  overview: StaffOverview | null;
  loading: boolean;
  error: string;
  /** Last time /staff/overview answered; shown as "Cập nhật lúc …" next to the connection pill. */
  lastSyncAt: Date | null;
  online: boolean;
  refresh: () => void;
}

const POLL_MS = 30_000;

/**
 * Shift data shared by the Staff layout (header pill, tab dot) and the overview page: one request every
 * 30 s, again when the tab regains focus or the network comes back. It is a convenience view only;
 * every scan is still authorised by the server.
 */
export function useStaffShellData(token: string | null): StaffShell {
  const [overview, setOverview] = useState<StaffOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [tick, setTick] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => { setLoading(true); setTick((value) => value + 1); }, []);

  useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    getStaffOverview(token, controller.signal)
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setOverview(data);
        setError('');
        setLastSyncAt(new Date());
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu ca trực.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, tick]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), POLL_MS);
    const goOnline = () => { setOnline(true); setTick((value) => value + 1); };
    const goOffline = () => setOnline(false);
    const onVisible = () => { if (document.visibilityState === 'visible') setTick((value) => value + 1); };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { overview, loading, error, lastSyncAt, online, refresh };
}

/** For pages rendered inside StaffLayout's <Outlet context>. */
export function useStaffShell(): StaffShell {
  return useOutletContext<StaffShell>();
}
