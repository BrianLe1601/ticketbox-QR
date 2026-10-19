import { useEffect, useSyncExternalStore } from "react";

import { nextGateBoundary, openGateEvents } from "@/lib/admin-gate";
import { getAdminDashboardSummary, type DashboardSummary } from "@/services/admin-dashboard.service";
import { listAdminEventsByStatus, type AdminEvent } from "@/services/admin-events.service";
import {
  onAdminRealtimeStatus, onAdminSignalsChanged, startAdminRealtime, stopAdminRealtime, type AdminRealtimeStatus,
} from "@/services/admin-realtime.service";

/**
 * Live signals for the Admin shell (sidebar badges, "Live" dot, theme suggestion) and the
 * Dashboard. One shared store so several consumers never multiply the requests.
 * Sources are real API data only: dashboard summary + published/ongoing Events.
 */
export interface AdminSignals {
  summary: DashboardSummary | null;
  /** Published/ongoing Events (the only ones whose gate can open). */
  activeEvents: AdminEvent[];
  openGates: AdminEvent[];
  loading: boolean;
  error: string | null;
  updatedAt: Date | null;
  /** "live" while the authenticated /ws/admin channel is up; otherwise polling only. */
  realtime: AdminRealtimeStatus;
}

const REFRESH_MS = 60_000;
const INITIAL: AdminSignals = { summary: null, activeEvents: [], openGates: [], loading: true, error: null, updatedAt: null, realtime: "offline" };
const MIN_PUSH_GAP_MS = 1_500;
let state: AdminSignals = INITIAL;
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;
let consumers = 0;
let refreshTimer: number | undefined;
let boundaryTimer: number | undefined;
let unsubscribeRealtime: Array<() => void> = [];
let lastPushRefresh = 0;
let pushTimer: number | undefined;

/** Coalesce bursts of pushes (e.g. every scan at an open gate) into one refetch per gap. */
function refreshFromPush() {
  if (pushTimer !== undefined) return;
  const wait = Math.max(0, lastPushRefresh + MIN_PUSH_GAP_MS - Date.now());
  pushTimer = window.setTimeout(() => {
    pushTimer = undefined;
    lastPushRefresh = Date.now();
    void refreshAdminSignals();
  }, wait);
}

function emit(next: Partial<AdminSignals>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function scheduleBoundary() {
  window.clearTimeout(boundaryTimer);
  const wait = nextGateBoundary(state.activeEvents);
  // A window opening/closing changes the badge without any server event.
  if (wait !== null && wait < 24 * 60 * 60 * 1000) {
    boundaryTimer = window.setTimeout(() => {
      emit({ openGates: openGateEvents(state.activeEvents) });
      scheduleBoundary();
    }, wait + 50);
  }
}

export function refreshAdminSignals(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const [summary, published, ongoing] = await Promise.all([
        getAdminDashboardSummary(),
        listAdminEventsByStatus("published"),
        listAdminEventsByStatus("ongoing"),
      ]);
      const activeEvents = [...ongoing, ...published];
      emit({ summary, activeEvents, openGates: openGateEvents(activeEvents), loading: false, error: null, updatedAt: new Date() });
      scheduleBoundary();
    } catch (cause) {
      emit({ loading: false, error: cause instanceof Error ? cause.message : "Không tải được tín hiệu vận hành" });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function onFocus() { if (document.visibilityState === "visible") void refreshAdminSignals(); }

function start() {
  void refreshAdminSignals();
  refreshTimer = window.setInterval(() => { if (document.visibilityState === "visible") void refreshAdminSignals(); }, REFRESH_MS);
  document.addEventListener("visibilitychange", onFocus);
  // /ws/admin pushes only changed topic names (including Event lifecycle); refetch REST.
  startAdminRealtime();
  unsubscribeRealtime = [
    onAdminSignalsChanged(() => refreshFromPush()),
    onAdminRealtimeStatus((status) => {
      const wasLive = state.realtime === "live";
      emit({ realtime: status });
      // Back online after a gap: catch up on anything missed while disconnected.
      if (status === "live" && !wasLive && state.updatedAt) refreshFromPush();
    }),
  ];
}

function stop() {
  window.clearInterval(refreshTimer);
  window.clearTimeout(boundaryTimer);
  document.removeEventListener("visibilitychange", onFocus);
  unsubscribeRealtime.forEach((unsubscribe) => unsubscribe());
  unsubscribeRealtime = [];
  window.clearTimeout(pushTimer);
  pushTimer = undefined;
  stopAdminRealtime();
  // Leaving Admin (e.g. logout) drops the data so another account never sees it.
  state = INITIAL;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Read the shared signals; the first mounted consumer starts polling, the last one stops it. */
export function useAdminSignals(): AdminSignals & { refresh: () => Promise<void> } {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state);
  useEffect(() => {
    consumers += 1;
    if (consumers === 1) start();
    return () => {
      consumers -= 1;
      if (consumers === 0) stop();
    };
  }, []);
  return { ...snapshot, refresh: refreshAdminSignals };
}
