import { useEffect, useState } from 'react';

interface WakeLockSentinelLike { released: boolean; release: () => Promise<void>; addEventListener: (type: 'release', listener: () => void) => void }
interface WakeLockApi { request: (type: 'screen') => Promise<WakeLockSentinelLike> }

const wakeLockApi = (): WakeLockApi | null =>
  (typeof navigator !== 'undefined' && 'wakeLock' in navigator ? (navigator as unknown as { wakeLock: WakeLockApi }).wakeLock : null);

/**
 * Keeps the screen on while `enabled` (Screen Wake Lock API). The browser drops the lock when the tab
 * is hidden or the device locks; it is requested again when the page becomes visible. Released on
 * disable/unmount. Unsupported browsers report `supported: false` and nothing happens.
 */
export function useWakeLock(enabled: boolean) {
  const supported = wakeLockApi() !== null;
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const api = wakeLockApi();
    if (!enabled || !api) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let disposed = false;
    const acquire = async () => {
      if (disposed || document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        sentinel = await api.request('screen');
        if (disposed) { void sentinel.release().catch(() => {}); return; }
        setActive(true);
        setError('');
        sentinel.addEventListener('release', () => { if (!disposed) setActive(false); });
      } catch {
        if (!disposed) { setActive(false); setError('Trình duyệt không cho giữ màn hình sáng lúc này (ví dụ đang tiết kiệm pin).'); }
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => {});
      setActive(false);
    };
  }, [enabled]);

  return { supported, active: enabled && active, error: enabled ? error : '' };
}
