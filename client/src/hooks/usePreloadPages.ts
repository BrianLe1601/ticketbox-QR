import { useEffect } from 'react';

import { preloadPages } from '@/routes/page-loaders';

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };

/** Preloads the given page chunks once the browser is idle after the shell has rendered. */
export function usePreloadPages(loaders: Record<string, () => Promise<unknown>>) {
  useEffect(() => {
    const w = window as IdleWindow;
    const run = () => preloadPages(loaders);
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout: 3000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(run, 1500);
    return () => window.clearTimeout(timer);
  }, [loaders]);
}
