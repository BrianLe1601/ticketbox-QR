/**
 * Vietnam-day date ranges shared by the Admin "Nhật ký check-in" and "Báo cáo" filters.
 * Dates are inclusive `YYYY-MM-DD` strings, exactly what the report/log APIs accept.
 */
export interface DayRange { from: string; to: string }

/** "2026-10-18" in Vietnam time. */
export function vnDay(now: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}

function shiftDay(day: string, delta: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export const isoDay = (value: string | null) =>
  (value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : "");

export type RangePreset = "all" | "today" | "7d" | "30d" | "month" | "year" | "custom";
export type FixedPreset = Exclude<RangePreset, "custom">;

export const PRESET_LABEL: Record<RangePreset, string> = {
  all: "Toàn bộ", today: "Hôm nay", "7d": "7 ngày qua", "30d": "30 ngày qua", month: "Tháng này", year: "Năm nay", custom: "Tùy chọn…",
};

/** Inclusive Vietnam-day ranges ending today. */
export function presetRange(preset: FixedPreset, now: number): DayRange {
  const today = vnDay(now);
  if (preset === "all") return { from: "", to: "" };
  if (preset === "today") return { from: today, to: today };
  if (preset === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  if (preset === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: shiftDay(today, preset === "7d" ? -6 : -29), to: today };
}

/** Which of the offered presets the range equals (first match wins), else "custom". */
export function presetOf(range: DayRange, now: number, offered: readonly FixedPreset[] = ["all", "today", "7d", "30d"]): RangePreset {
  for (const preset of offered) {
    const candidate = presetRange(preset, now);
    if (candidate.from === range.from && candidate.to === range.to) return preset;
  }
  return "custom";
}

const vnDate = (day: string) => day.split("-").reverse().join("/");

export function rangeText(range: DayRange) {
  if (!range.from && !range.to) return "Toàn bộ thời gian";
  if (range.from && range.to) return range.from === range.to ? `Ngày ${vnDate(range.from)}` : `${vnDate(range.from)} – ${vnDate(range.to)}`;
  return range.from ? `Từ ${vnDate(range.from)}` : `Đến hết ${vnDate(range.to)}`;
}

/** File-name part: "2026-10-18", "2026-10-01_den_2026-10-18", "tu_…", "den_…" or "xuat_<today>". */
export function rangeSlug(range: DayRange, now: number) {
  const { from, to } = range;
  return from && to ? (from === to ? from : `${from}_den_${to}`) : from ? `tu_${from}` : to ? `den_${to}` : `xuat_${vnDay(now)}`;
}
