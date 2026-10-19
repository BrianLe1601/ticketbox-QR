/**
 * Vietnamese wording for the Event publish-readiness codes returned by the server
 * (server/src/modules/events/admin-events.service.ts `getReadiness`). The codes are the stable
 * contract; never show them raw. Grouped into a checklist so the Admin sees what passes too.
 */
export type ReadinessFix = "event" | "tickets" | "settings";

interface CodeInfo { text: string; fix: ReadinessFix }

const CODES: Record<string, CodeInfo> = {
  EVENT_NAME_REQUIRED: { text: "Chưa có tên sự kiện.", fix: "event" },
  COMPLETE_LOCATION_REQUIRED: { text: "Địa điểm chưa đủ tên, địa chỉ và thành phố.", fix: "settings" },
  COVER_IMAGE_REQUIRED: { text: "Chưa có ảnh bìa.", fix: "event" },
  VENUE_CAPACITY_REQUIRED: { text: "Địa điểm chưa có sức chứa.", fix: "settings" },
  SALES_WINDOW_REQUIRED: { text: "Chưa đặt khung giờ bán vé.", fix: "event" },
  CHECKIN_WINDOW_REQUIRED: { text: "Chưa đặt khung giờ check-in.", fix: "event" },
  INVALID_EVENT_TIME: { text: "Giờ kết thúc phải sau giờ bắt đầu.", fix: "event" },
  EVENT_START_MUST_BE_FUTURE: { text: "Giờ bắt đầu đã qua; dời lịch sang tương lai.", fix: "event" },
  SALES_END_AFTER_EVENT_END: { text: "Bán vé kết thúc sau khi sự kiện kết thúc.", fix: "event" },
  SALES_END_AFTER_CHECKIN_END: { text: "Bán vé kết thúc sau khi đóng check-in.", fix: "event" },
  SALES_START_NOT_BEFORE_EVENT: { text: "Phải mở bán trước giờ bắt đầu.", fix: "event" },
  CHECKIN_START_WRONG_DAY: { text: "Check-in phải mở cùng ngày bắt đầu sự kiện.", fix: "event" },
  CHECKIN_START_AFTER_EVENT_END: { text: "Check-in mở sau khi sự kiện kết thúc.", fix: "event" },
  CHECKIN_END_AFTER_EVENT_END: { text: "Check-in đóng sau khi sự kiện kết thúc.", fix: "event" },
  CHECKIN_TOO_LATE: { text: "Check-in phải mở sớm ít nhất 2 giờ trước giờ bắt đầu.", fix: "event" },
  VALID_TICKET_TYPE_REQUIRED: { text: "Cần ít nhất một hạng vé hợp lệ đang hoạt động.", fix: "tickets" },
  TICKET_CAPACITY_EXCEEDS_VENUE: { text: "Tổng số vé các hạng vượt sức chứa địa điểm.", fix: "tickets" },
};

/** One readable sentence per code; an unknown code is still shown, never hidden. */
export function readinessText(code: string): string {
  return CODES[code]?.text ?? `Điều kiện chưa đạt (${code}).`;
}

export function readinessFix(code: string): ReadinessFix {
  return CODES[code]?.fix ?? "event";
}

/** "Chưa đủ điều kiện: Chưa có ảnh bìa. Chưa đặt khung giờ check-in." */
export function readinessSummary(missing: readonly string[]): string {
  return missing.length ? missing.map(readinessText).join(" ") : "Cần ít nhất một hạng vé hợp lệ đang hoạt động.";
}

export interface ReadinessGroup { id: string; label: string; ok: boolean; problems: Array<{ code: string; text: string; fix: ReadinessFix }> }

const GROUPS: Array<{ id: string; label: string; codes: string[] }> = [
  { id: "info", label: "Tên, ảnh bìa và địa điểm", codes: ["EVENT_NAME_REQUIRED", "COVER_IMAGE_REQUIRED", "COMPLETE_LOCATION_REQUIRED", "VENUE_CAPACITY_REQUIRED"] },
  { id: "schedule", label: "Lịch sự kiện", codes: ["INVALID_EVENT_TIME", "EVENT_START_MUST_BE_FUTURE"] },
  { id: "sales", label: "Khung giờ bán vé", codes: ["SALES_WINDOW_REQUIRED", "SALES_START_NOT_BEFORE_EVENT", "SALES_END_AFTER_EVENT_END", "SALES_END_AFTER_CHECKIN_END"] },
  { id: "checkin", label: "Khung giờ check-in", codes: ["CHECKIN_WINDOW_REQUIRED", "CHECKIN_START_WRONG_DAY", "CHECKIN_START_AFTER_EVENT_END", "CHECKIN_END_AFTER_EVENT_END", "CHECKIN_TOO_LATE"] },
  { id: "tickets", label: "Hạng vé hợp lệ", codes: ["VALID_TICKET_TYPE_REQUIRED", "TICKET_CAPACITY_EXCEEDS_VENUE"] },
];

/** Checklist rows in a fixed order; codes the UI does not know land in an extra "Khác" row. */
export function readinessChecklist(missing: readonly string[]): ReadinessGroup[] {
  const known = new Set(GROUPS.flatMap((group) => group.codes));
  const rows = GROUPS.map((group) => {
    const problems = missing.filter((code) => group.codes.includes(code)).map((code) => ({ code, text: readinessText(code), fix: readinessFix(code) }));
    return { id: group.id, label: group.label, ok: problems.length === 0, problems };
  });
  const other = missing.filter((code) => !known.has(code));
  if (other.length) rows.push({ id: "other", label: "Điều kiện khác", ok: false, problems: other.map((code) => ({ code, text: readinessText(code), fix: readinessFix(code) })) });
  return rows;
}
