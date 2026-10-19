/** Pure helpers for the Staff portal (/staff/*). Nothing here decides access: the server checks every scan. */

import type { AssignmentOperationalState } from "@/services/checkin.service";

export type FeedbackTone = "success" | "warning" | "failed";
export type AssignmentSegmentKey = "all" | "open" | "upcoming" | "history";

const VN = "Asia/Ho_Chi_Minh";

/** "Kim Bửu Lê" -> "KL"; one word -> its first two letters; empty -> "NV". */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "NV";
  if (words.length === 1) return words[0]!.slice(0, 2).toLocaleUpperCase("vi-VN");
  return `${words[0]![0]}${words[words.length - 1]![0]}`.toLocaleUpperCase("vi-VN");
}

/** Wall-clock "HH:mm:ss" in Vietnam time. */
export function clockText(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: VN, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date);
}

/** "HH:mm" in Vietnam time. */
export function timeText(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: VN, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

/** Date badge of a shift card: { day: "17", month: "TH10", weekday: "T6" } in Vietnam time. */
export function dateBadge(iso: string): { day: string; month: string; weekday: string } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: VN, day: "2-digit", month: "numeric", weekday: "short" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdays: Record<string, string> = { Mon: "T2", Tue: "T3", Wed: "T4", Thu: "T5", Fri: "T6", Sat: "T7", Sun: "CN" };
  return { day: get("day"), month: `TH${get("month")}`, weekday: weekdays[get("weekday")] ?? "" };
}

/** Time left until `targetIso`, in words: "2 giờ 05 phút", "12 phút", "dưới 1 phút"; null once it has passed. */
export function countdownText(targetIso: string, now: Date): string | null {
  const ms = new Date(targetIso).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "dưới 1 phút";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days} ngày ${hours} giờ`;
  if (hours > 0) return `${hours} giờ ${String(mins).padStart(2, "0")} phút`;
  return `${mins} phút`;
}

/** Share of the check-in window already elapsed, 0..1 (for the open-gate progress bar). */
export function gateProgress(startIso: string, endIso: string, now: Date): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!(end > start)) return 0;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}

export interface ScanTally { total: number; allowed: number; refused: number; perMinute: number }

/**
 * This browser session's own scans at the gate (not a server statistic): how many, how many let in,
 * and the pace over the last `windowMinutes` minutes.
 */
export function sessionTally(scans: Array<{ at: number; allowed: boolean }>, now: number, windowMinutes = 5): ScanTally {
  const allowed = scans.filter((scan) => scan.allowed).length;
  const recent = scans.filter((scan) => now - scan.at <= windowMinutes * 60_000).length;
  return { total: scans.length, allowed, refused: scans.length - allowed, perMinute: Math.round((recent / windowMinutes) * 10) / 10 };
}

/** Vibration patterns (ms) per verdict tone: one short pulse to let in, longer pulses to stop. */
export const VIBRATION: Record<FeedbackTone, number[]> = {
  success: [80],
  warning: [160, 80, 160],
  failed: [260, 100, 260],
};

/** Beep plan per tone: [frequency Hz, duration ms] steps. */
export const BEEPS: Record<FeedbackTone, Array<[number, number]>> = {
  success: [[1046, 120]],
  warning: [[660, 140], [0, 70], [660, 140]],
  failed: [[330, 220], [0, 80], [262, 260]],
};

/** keepAwake (Wake Lock) is off by default: it costs battery. */
export interface FeedbackPrefs { sound: boolean; vibrate: boolean; keepAwake: boolean }
export const DEFAULT_FEEDBACK: FeedbackPrefs = { sound: true, vibrate: true, keepAwake: false };

type PrefStorage = Pick<Storage, "getItem" | "setItem">;
const feedbackKey = (accountId: number) => `ticketbox:staff:${accountId}:scan-feedback`;

/** Browser-local preference per account; anything unreadable falls back to sound + vibration on, keep-awake off. */
export function readFeedbackPrefs(accountId: number, storage: PrefStorage | null): FeedbackPrefs {
  try {
    const raw = storage?.getItem(feedbackKey(accountId));
    if (!raw) return { ...DEFAULT_FEEDBACK };
    const parsed = JSON.parse(raw) as Partial<FeedbackPrefs>;
    return { sound: parsed.sound !== false, vibrate: parsed.vibrate !== false, keepAwake: parsed.keepAwake === true };
  } catch {
    return { ...DEFAULT_FEEDBACK };
  }
}

export function saveFeedbackPrefs(accountId: number, prefs: FeedbackPrefs, storage: PrefStorage | null): boolean {
  try { storage?.setItem(feedbackKey(accountId), JSON.stringify(prefs)); return Boolean(storage); } catch { return false; }
}

/** History summary from two server totals (all results, SUCCESS only) of the same assignment. */
export function historySummary(total: number, success: number) {
  const safeTotal = Math.max(0, total);
  const allowed = Math.min(Math.max(0, success), safeTotal);
  return { total: safeTotal, allowed, refused: safeTotal - allowed };
}

/** Empty-state copy per assignment segment. */
export function emptySegmentText(segment: AssignmentSegmentKey): { title: string; text: string } {
  switch (segment) {
    case "open": return { title: "Chưa có cổng nào đang mở", text: "Cổng mở theo khung giờ check-in Quản trị viên đặt cho từng sự kiện." };
    case "upcoming": return { title: "Chưa có ca trực sắp tới", text: "Khi Quản trị viên phân công bạn vào một sự kiện, ca trực sẽ xuất hiện ở đây." };
    case "history": return { title: "Chưa có ca trực đã kết thúc", text: "Ca trực đã đóng cổng, đã kết thúc hoặc đã thu hồi sẽ được lưu ở đây để tra cứu." };
    default: return { title: "Bạn chưa được phân công sự kiện nào", text: "Hãy báo Quản trị viên phân công bạn vào sự kiện; danh sách tự cập nhật 30 giây một lần." };
  }
}

/** Label and tone of an assignment state (server-derived operationalState), used by cards and the detail dialog. */
export const ASSIGNMENT_STATE: Record<AssignmentOperationalState, { label: string; tone: "live" | "info" | "warning" | "muted" | "danger" }> = {
  checkin_open: { label: "Đang mở cổng", tone: "live" },
  upcoming: { label: "Sắp tới", tone: "info" },
  preparing: { label: "Đang chuẩn bị", tone: "warning" },
  checkin_closed: { label: "Đã đóng cổng", tone: "muted" },
  completed: { label: "Đã kết thúc", tone: "muted" },
  cancelled: { label: "Đã hủy", tone: "danger" },
  revoked: { label: "Đã thu hồi phân công", tone: "warning" },
};

/** "12/200 đã vào · còn 188" plus the 0..1 share for the gate attendance bar. */
export function attendanceView(value: { admitted: number; validTickets: number; remaining: number } | null) {
  if (!value) return null;
  const total = Math.max(0, value.validTickets);
  const admitted = Math.max(0, value.admitted);
  return {
    text: `${admitted.toLocaleString('vi-VN')}/${total.toLocaleString('vi-VN')} vé đã vào`,
    remaining: `còn ${Math.max(0, value.remaining).toLocaleString('vi-VN')} vé chưa vào`,
    share: total > 0 ? Math.min(1, admitted / total) : 0,
  };
}
