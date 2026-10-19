/**
 * Admin Event form: values, conversions and browser-side checks. These checks only give early
 * feedback; the Event service and the schema constraints re-validate every save.
 * Date fields hold `datetime-local` strings in the browser's local time, as before.
 */
import type { AdminEvent, EventPayload } from "@/services/admin-events.service";

export type PublishMode = "manual" | "scheduled";

export interface EventFormValues {
  name: string; description: string; category: string;
  coverImageUrl: string; coverImagePublicId: string; coverImageAlt: string;
  startTime: string; endTime: string; salesStartAt: string; salesEndAt: string;
  checkinStartAt: string; checkinEndAt: string;
  publishMode: PublishMode; scheduledPublishAt: string;
  syncVenue: boolean; confirmPublicVenueChange: boolean;
}

export type EventFormField = keyof EventFormValues | "venue" | "staff";
export interface EventFormError { field: EventFormField; message: string }

export const EMPTY_EVENT_FORM: EventFormValues = {
  name: "", description: "", category: "", coverImageUrl: "", coverImagePublicId: "", coverImageAlt: "",
  startTime: "", endTime: "", salesStartAt: "", salesEndAt: "", checkinStartAt: "", checkinEndAt: "",
  publishMode: "manual", scheduledPublishAt: "", syncVenue: false, confirmPublicVenueChange: false,
};

const pad = (part: number) => String(part).padStart(2, "0");

/** ISO instant -> `datetime-local` value in the browser's time zone. */
export function toLocalInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formFromEvent(event: AdminEvent): EventFormValues {
  return {
    name: event.name, description: event.description ?? "", category: event.category,
    coverImageUrl: event.coverImageUrl ?? "", coverImagePublicId: event.coverImagePublicId ?? "", coverImageAlt: event.coverImageAlt ?? "",
    startTime: toLocalInput(event.startTime), endTime: toLocalInput(event.endTime),
    salesStartAt: toLocalInput(event.salesStartAt), salesEndAt: toLocalInput(event.salesEndAt),
    checkinStartAt: toLocalInput(event.checkinStartAt), checkinEndAt: toLocalInput(event.checkinEndAt),
    publishMode: event.scheduledPublishAt ? "scheduled" : "manual", scheduledPublishAt: toLocalInput(event.scheduledPublishAt),
    syncVenue: false, confirmPublicVenueChange: false,
  };
}

export interface EventFormContext {
  /** The Event being edited, or null when creating. */
  editing: Pick<AdminEvent, "status" | "activeStaffCount" | "startTime" | "endTime"> | null;
  venueMissing: boolean;
}

const time = (value: string) => new Date(value).getTime();

export function validateEventForm(form: EventFormValues, { editing, venueMissing }: EventFormContext): EventFormError[] {
  const errors: EventFormError[] = [];
  const add = (field: EventFormField, message: string) => errors.push({ field, message });

  if (!form.name.trim()) add("name", "Tên sự kiện là bắt buộc.");
  if (!form.category) add("category", "Chọn thể loại âm nhạc cho sự kiện.");
  if (venueMissing) add("venue", "Chưa cấu hình địa điểm tổ chức. Nhập địa điểm tại trang Cài đặt trước khi tạo sự kiện.");
  if (form.syncVenue && editing?.status === "published" && !form.confirmPublicVenueChange) add("confirmPublicVenueChange", "Sự kiện đã công bố: tích xác nhận để đổi địa điểm đang hiển thị công khai.");
  if (form.coverImageUrl.trim()) {
    try {
      const url = new URL(form.coverImageUrl.trim());
      if (!["http:", "https:"].includes(url.protocol)) add("coverImageUrl", "URL ảnh bìa phải bắt đầu bằng http:// hoặc https://.");
    } catch { add("coverImageUrl", "URL ảnh bìa không hợp lệ, ví dụ https://example.com/event.jpg."); }
  }

  if (!form.startTime) add("startTime", "Chọn thời gian bắt đầu sự kiện.");
  if (!form.endTime) add("endTime", "Chọn thời gian kết thúc sự kiện.");
  if (!form.salesStartAt) add("salesStartAt", "Chọn thời gian bắt đầu bán vé.");
  if (!form.salesEndAt) add("salesEndAt", "Chọn thời gian kết thúc bán vé.");
  if (!form.checkinStartAt) add("checkinStartAt", "Chọn thời gian bắt đầu check-in.");
  if (!form.checkinEndAt) add("checkinEndAt", "Chọn thời gian kết thúc check-in.");

  if (form.startTime && form.endTime && time(form.endTime) <= time(form.startTime)) add("endTime", "Thời gian kết thúc sự kiện phải sau thời gian bắt đầu.");
  if (form.salesStartAt && form.salesEndAt && time(form.salesEndAt) <= time(form.salesStartAt)) add("salesEndAt", "Thời gian kết thúc bán vé phải sau thời gian bắt đầu bán.");
  if (form.salesStartAt && form.startTime && time(form.salesStartAt) >= time(form.startTime)) add("salesStartAt", "Phải mở bán vé trước khi sự kiện bắt đầu.");
  if (form.salesEndAt && form.endTime && time(form.salesEndAt) > time(form.endTime)) add("salesEndAt", "Không được kết thúc bán vé sau khi sự kiện kết thúc.");
  else if (form.salesEndAt && form.checkinEndAt && time(form.salesEndAt) > time(form.checkinEndAt)) add("salesEndAt", "Không được kết thúc bán vé sau khi đóng check-in: khách mua sau giờ đó không vào cổng được.");
  if (form.checkinStartAt && form.checkinEndAt && time(form.checkinEndAt) <= time(form.checkinStartAt)) add("checkinEndAt", "Thời gian kết thúc check-in phải sau thời gian bắt đầu check-in.");
  if (form.checkinStartAt && form.endTime && time(form.checkinStartAt) > time(form.endTime)) add("checkinStartAt", "Thời gian bắt đầu check-in không được sau khi sự kiện kết thúc.");
  if (form.checkinEndAt && form.endTime && time(form.checkinEndAt) > time(form.endTime)) add("checkinEndAt", "Không được kết thúc check-in sau khi sự kiện kết thúc.");
  if (form.checkinStartAt && form.startTime && form.checkinStartAt.slice(0, 10) !== form.startTime.slice(0, 10)) add("checkinStartAt", "Thời gian bắt đầu check-in phải cùng ngày bắt đầu sự kiện.");
  if (form.checkinStartAt && form.startTime && time(form.checkinStartAt) > time(form.startTime) - 2 * 3_600_000) add("checkinStartAt", "Phải mở check-in sớm ít nhất 2 giờ trước khi sự kiện bắt đầu.");

  if (form.publishMode === "scheduled" && !form.scheduledPublishAt) add("scheduledPublishAt", "Vui lòng chọn thời gian tự động công bố.");
  if (form.publishMode === "scheduled" && form.scheduledPublishAt && form.startTime && time(form.scheduledPublishAt) >= time(form.startTime)) add("scheduledPublishAt", "Thời gian tự động công bố phải trước khi sự kiện bắt đầu.");

  if (editing && editing.activeStaffCount > 0) {
    const startChanged = form.startTime && time(form.startTime) !== new Date(editing.startTime).getTime();
    const endChanged = form.endTime && time(form.endTime) !== new Date(editing.endTime).getTime();
    if (startChanged || endChanged) add("staff", `Sự kiện đang có ${editing.activeStaffCount} nhân viên được phân công. Vui lòng thu hồi phân công tại trang Nhân viên trước khi thay đổi lịch.`);
  }
  return errors;
}

/** First message per field, for inline errors. */
export function errorsByField(errors: readonly EventFormError[]): Partial<Record<EventFormField, string>> {
  const map: Partial<Record<EventFormField, string>> = {};
  for (const error of errors) if (!map[error.field]) map[error.field] = error.message;
  return map;
}

export function toEventPayload(form: EventFormValues): EventPayload {
  const iso = (value: string) => (value ? new Date(value).toISOString() : null);
  return {
    name: form.name.trim(), description: form.description.trim() || null, category: form.category.trim(),
    coverImageUrl: form.coverImageUrl.trim() || null, coverImagePublicId: form.coverImagePublicId.trim() || null, coverImageAlt: form.coverImageAlt.trim() || null,
    startTime: iso(form.startTime)!, endTime: iso(form.endTime)!, salesStartAt: iso(form.salesStartAt)!, salesEndAt: iso(form.salesEndAt)!,
    checkinStartAt: iso(form.checkinStartAt)!, checkinEndAt: iso(form.checkinEndAt)!,
    scheduledPublishAt: form.publishMode === "scheduled" ? iso(form.scheduledPublishAt) : null,
  };
}

/** Latest allowed check-in start for a given Event start (same day, ≥ 2 h earlier). */
export function checkinStartMax(startTime: string): string {
  if (!startTime) return "";
  return toLocalInput(new Date(time(startTime) - 2 * 3_600_000));
}

/* ---------- schedule suggestions (UI help only; the server still validates every save) ---------- */

const HOUR = 3_600_000;
export type ScheduleField = "salesStartAt" | "salesEndAt" | "checkinStartAt" | "checkinEndAt";
export const SCHEDULE_FIELDS: ScheduleField[] = ["salesStartAt", "salesEndAt", "checkinStartAt", "checkinEndAt"];

const validRange = (form: Pick<EventFormValues, "startTime" | "endTime">) =>
  Boolean(form.startTime && form.endTime && time(form.endTime) > time(form.startTime));

/**
 * Suggested sales/check-in times for a start/end pair: sell from now until the show starts (the
 * buyer has time to get the QR email), open the gates 2 h before (the minimum) and close them at the
 * end (the maximum). A suggestion that cannot satisfy the rules (e.g. a show starting before 02:00,
 * or one already starting) is left out rather than proposed wrong.
 */
export function suggestSchedule(form: Pick<EventFormValues, "startTime" | "endTime"> & { checkinEndAt?: string }, now: number): Partial<Record<ScheduleField, string>> {
  if (!validRange(form)) return {};
  const start = time(form.startTime);
  // Sales may not outlast check-in: if the Admin closes the gates before the show starts, stop sales then.
  const gatesClose = form.checkinEndAt && time(form.checkinEndAt) < start ? form.checkinEndAt : form.startTime;
  const out: Partial<Record<ScheduleField, string>> = { salesEndAt: gatesClose, checkinEndAt: form.endTime };
  const openNow = new Date(Math.floor(now / 60_000) * 60_000);
  if (openNow.getTime() < start) out.salesStartAt = toLocalInput(openNow);
  const gates = toLocalInput(new Date(start - 2 * HOUR));
  if (gates.slice(0, 10) === form.startTime.slice(0, 10)) out.checkinStartAt = gates;
  return out;
}

/**
 * Applies suggestions to the fields that are empty or still hold an untouched suggestion; values
 * the Admin typed are never overwritten. Returns the new values and which fields are suggestions.
 */
export function applySuggestions(form: EventFormValues, suggested: ReadonlySet<ScheduleField>, now: number) {
  const next = { ...form };
  const marks = new Set<ScheduleField>();
  // A typed check-in end bounds the suggested sales end; a suggested one is recomputed below.
  const proposal = suggestSchedule({ ...form, checkinEndAt: suggested.has("checkinEndAt") ? "" : form.checkinEndAt }, now);
  for (const field of SCHEDULE_FIELDS) {
    const replaceable = !form[field] || suggested.has(field);
    if (!replaceable) continue;
    if (proposal[field]) { next[field] = proposal[field]!; marks.add(field); }
    else if (suggested.has(field)) next[field] = ""; // a stale suggestion that no longer fits is cleared
  }
  return { form: next, suggested: marks };
}

export type SalesEndPreset = "start" | "beforeStart" | "checkinEnd";
export const SALES_END_PRESETS: Array<{ key: SalesEndPreset; label: string; hint: string }> = [
  { key: "start", label: "Đến giờ mở màn", hint: "Khuyến nghị: khách có thời gian nhận email QR trước khi vào cổng." },
  { key: "beforeStart", label: "Trước mở màn 2 giờ", hint: "An toàn nhất cho việc gửi email vé." },
  { key: "checkinEnd", label: "Đến khi đóng check-in", hint: "Muộn nhất cho phép: bán cả cho khách tới muộn, tới lúc cổng đóng." },
];

/**
 * The sales-end value of a preset, or "" when it cannot be applied: no schedule, no check-in end
 * yet, not after sales start, or after check-in end (the server refuses SALES_AFTER_CHECKIN_END).
 */
export function salesEndFor(preset: SalesEndPreset, form: Pick<EventFormValues, "startTime" | "endTime" | "salesStartAt" | "checkinEndAt">) {
  if (!validRange(form)) return "";
  const value = preset === "start" ? form.startTime : preset === "checkinEnd" ? form.checkinEndAt : toLocalInput(new Date(time(form.startTime) - 2 * HOUR));
  if (!value) return "";
  if (form.salesStartAt && time(value) <= time(form.salesStartAt)) return "";
  if (form.checkinEndAt && time(value) > time(form.checkinEndAt)) return "";
  return value;
}

export interface ScheduleWarning { field: ScheduleField; message: string; /** "error" also blocks saving (same rule as the server). */ severity: "error" | "warning" }

const clock = (value: string) => value.slice(11, 16);

/**
 * Times that pass the server rules but may surprise buyers. Warnings never block saving: an Admin
 * may sell to late-comers on purpose. Selling after check-in end is shown live as an error: saving is
 * refused by validateEventForm and by the server (SALES_AFTER_CHECKIN_END).
 */
export function scheduleWarnings(form: Pick<EventFormValues, "startTime" | "endTime" | "salesEndAt" | "checkinEndAt">): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];
  if (form.salesEndAt && form.checkinEndAt && time(form.salesEndAt) > time(form.checkinEndAt)) {
    warnings.push({ field: "salesEndAt", severity: "error", message: `Bán vé đang kết thúc sau giờ đóng check-in (${clock(form.checkinEndAt)}): khách mua sau giờ đó không vào cổng được. Dời giờ kết thúc bán về trước hoặc đúng lúc này.` });
  } else if (form.salesEndAt && form.startTime && time(form.salesEndAt) > time(form.startTime)) {
    warnings.push({ field: "salesEndAt", severity: "warning", message: `Vẫn bán vé sau giờ mở màn (${clock(form.startTime)}): khách mua lúc này sẽ vào muộn.` });
  }
  return warnings;
}
