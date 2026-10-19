import { useCallback, useSyncExternalStore } from "react";

/**
 * Light is the default everywhere. The choice is browser-local, namespaced by scope
 * (and account, when there is one) and shared between tabs through the storage event.
 * When storage is blocked or corrupt the choice still works for this page load
 * (in-memory fallback) and never throws.
 *
 * "auto" follows the Vietnam clock (light 06:00-17:59, dark 18:00-05:59), never the OS
 * preference. A manual light/dark choice always wins because it replaces "auto".
 */
export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "auto";
export type ThemeScope = "admin" | "staff" | "login";

const CHANGE_EVENT = "ticketbox-theme-change";
const AUTO_TICK_MS = 60_000;
const memory = new Map<string, ThemePreference>();

const storageKey = (scope: ThemeScope, accountId?: number | null) =>
  `ticketbox:theme:${scope}${accountId ? `:${accountId}` : ""}`;

/**
 * Last preference of a scope without an account, read by index.html before React renders so a dark
 * page never flashes light. Login has no account, so its normal key already serves.
 */
export const bootKey = (scope: ThemeScope) => `ticketbox:theme:${scope}:last`;
export const BOOT_KEY = bootKey("admin");

const isPreference = (value: unknown): value is ThemePreference => value === "light" || value === "dark" || value === "auto";

/** Hour 0-23 in Asia/Ho_Chi_Minh (UTC+7, no daylight saving). */
export function vietnamHour(now: Date = new Date()): number {
  return (now.getUTCHours() + 7) % 24;
}

export function resolveTheme(preference: ThemePreference, now: Date = new Date()): ThemeMode {
  if (preference !== "auto") return preference;
  const hour = vietnamHour(now);
  return hour >= 6 && hour < 18 ? "light" : "dark";
}

/** "Sáng", "Tối" or "Tự động (Tối)" for labels. */
export function themeSummary(preference: ThemePreference, theme: ThemeMode): string {
  const resolved = theme === "dark" ? "Tối" : "Sáng";
  return preference === "auto" ? `Tự động (${resolved})` : resolved;
}

export function readThemePreference(scope: ThemeScope, accountId?: number | null): ThemePreference {
  const key = storageKey(scope, accountId);
  const remembered = memory.get(key);
  if (remembered) return remembered;
  try {
    const stored = window.localStorage.getItem(key);
    return isPreference(stored) ? stored : "light";
  } catch {
    return "light";
  }
}

/** Resolved theme for the current moment. */
export function readTheme(scope: ThemeScope, accountId?: number | null): ThemeMode {
  return resolveTheme(readThemePreference(scope, accountId));
}

export function writeTheme(scope: ThemeScope, preference: ThemePreference, accountId?: number | null): boolean {
  const key = storageKey(scope, accountId);
  memory.set(key, preference);
  let stored = true;
  try {
    window.localStorage.setItem(key, preference);
    if (scope === "admin" || scope === "staff") window.localStorage.setItem(bootKey(scope), preference);
  } catch {
    stored = false;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return stored;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  // "auto" can flip at 06:00/18:00 without any user action.
  const timer = window.setInterval(onChange, AUTO_TICK_MS);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.clearInterval(timer);
  };
}

export function useTheme(scope: ThemeScope, accountId?: number | null) {
  const preference = useSyncExternalStore<ThemePreference>(
    subscribe,
    () => readThemePreference(scope, accountId),
    () => "light",
  );
  const theme = useSyncExternalStore<ThemeMode>(
    subscribe,
    () => resolveTheme(readThemePreference(scope, accountId)),
    () => "light",
  );
  const setPreference = useCallback((next: ThemePreference) => { writeTheme(scope, next, accountId); }, [scope, accountId]);
  const setTheme = useCallback((next: ThemeMode) => { writeTheme(scope, next, accountId); }, [scope, accountId]);
  const toggle = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [setTheme, theme]);
  return { theme, preference, setTheme, setPreference, toggle };
}
