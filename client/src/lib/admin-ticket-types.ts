/**
 * Pure Ticket Type logic for the Admin "Hạng vé" page: display state, summary-card filters,
 * inventory totals, action availability and form checks. The rules mirror
 * server/src/modules/ticket-types/admin-ticket-types.service.ts so the UI can explain a disabled
 * action; the server still decides every save.
 */
import type { AdminEvent, EventStatus } from "@/services/admin-events.service";
import type { AdminTicketType } from "@/services/admin-ticket-types.service";

type Tier = Pick<AdminTicketType, "isActive" | "capacity" | "reservedQuantity" | "soldQuantity" | "availableQuantity" | "salesStartAt" | "salesEndAt" | "price">;
type TierEvent = Pick<AdminEvent, "status" | "salesStartAt" | "salesEndAt" | "endTime" | "visibility">;

/* ---------- default Event ---------- */

const PICK_ORDER: EventStatus[] = ["ongoing", "published", "draft", "completed", "cancelled"];

/** Event to open when the URL names none: on sale first (soonest start), then Drafts, then history. */
export function defaultTierEvent<T extends Pick<AdminEvent, "status" | "startTime">>(events: readonly T[]): T | null {
  return [...events].sort((a, b) => PICK_ORDER.indexOf(a.status) - PICK_ORDER.indexOf(b.status) || Date.parse(a.startTime) - Date.parse(b.startTime))[0] ?? null;
}

/* ---------- display state ---------- */

export type TierState = "active" | "scheduled" | "paused" | "sold_out" | "closed";

/** Effective sales window: the tier's own window, else the Event default. */
export function salesWindow(tier: Pick<Tier, "salesStartAt" | "salesEndAt">, event: Pick<TierEvent, "salesStartAt" | "salesEndAt">) {
  return { start: tier.salesStartAt ?? event.salesStartAt ?? null, end: tier.salesEndAt ?? event.salesEndAt ?? null, inherited: !tier.salesStartAt && !tier.salesEndAt };
}

export function tierState(tier: Tier, event: TierEvent, now: number): TierState {
  if (!tier.isActive) return "paused";
  if (tier.availableQuantity <= 0) return "sold_out";
  const { start, end } = salesWindow(tier, event);
  if ((end && Date.parse(end) <= now) || Date.parse(event.endTime) <= now) return "closed";
  if (start && Date.parse(start) > now) return "scheduled";
  return "active";
}

/* ---------- summary-card filters (AGENTS: tier predicates, never Event lifecycle) ---------- */

export type TierFilter = "all" | "active" | "paused" | "soldOut" | "hasReserved";
export const TIER_FILTERS: TierFilter[] = ["all", "active", "paused", "soldOut", "hasReserved"];

export function matchesTierFilter(tier: Tier, filter: TierFilter) {
  if (filter === "active") return tier.isActive;
  if (filter === "paused") return !tier.isActive;
  if (filter === "soldOut") return tier.availableQuantity <= 0;
  if (filter === "hasReserved") return tier.reservedQuantity > 0;
  return true;
}

export function tierCounts(tiers: readonly Tier[]): Record<TierFilter, number> {
  const counts = { all: 0, active: 0, paused: 0, soldOut: 0, hasReserved: 0 } as Record<TierFilter, number>;
  for (const tier of tiers) for (const filter of TIER_FILTERS) if (matchesTierFilter(tier, filter)) counts[filter] += 1;
  return counts;
}

/* ---------- inventory ---------- */

export interface Inventory {
  venueCapacity: number; allocated: number; sold: number; reserved: number; available: number; unallocated: number;
  /** Simulated: confirmed sales at list price, and the ceiling if every allocated ticket sold. */
  soldValue: number; maxValue: number;
}

export function inventory(tiers: readonly Tier[], venueCapacity: number | null | undefined): Inventory {
  const sum = (pick: (tier: Tier) => number) => tiers.reduce((total, tier) => total + pick(tier), 0);
  const venue = venueCapacity ?? 0;
  const allocated = sum((tier) => tier.capacity);
  return {
    venueCapacity: venue, allocated,
    sold: sum((tier) => tier.soldQuantity), reserved: sum((tier) => tier.reservedQuantity), available: sum((tier) => Math.max(0, tier.availableQuantity)),
    unallocated: Math.max(0, venue - allocated),
    soldValue: sum((tier) => tier.soldQuantity * tier.price), maxValue: sum((tier) => tier.capacity * tier.price),
  };
}

/* ---------- actions ---------- */

export interface Availability { allowed: boolean; reason?: string }
const ok: Availability = { allowed: true };
const no = (reason: string): Availability => ({ allowed: false, reason });
const TERMINAL: EventStatus[] = ["completed", "cancelled"];
const ON_SALE: EventStatus[] = ["published", "ongoing"];
const committed = (tier: Tier) => tier.reservedQuantity + tier.soldQuantity;

export function isReadOnly(event: Pick<TierEvent, "status">) {
  return TERMINAL.includes(event.status);
}

export function canCreateTier(event: TierEvent, unallocated: number, now: number): Availability {
  if (isReadOnly(event)) return no("Sự kiện đã kết thúc hoặc đã hủy, kho vé chỉ đọc.");
  if (Date.parse(event.endTime) <= now) return no("Sự kiện đã qua giờ kết thúc.");
  if (unallocated <= 0) return no("Đã phân bổ hết sức chứa địa điểm.");
  return ok;
}

export function canEditTier(event: Pick<TierEvent, "status">): Availability {
  return isReadOnly(event) ? no("Sự kiện đã kết thúc hoặc đã hủy, kho vé chỉ đọc.") : ok;
}

/** Price after publish: locked forever once sold/reserved; otherwise pause first. */
export function priceLock(tier: Tier | null, event: Pick<TierEvent, "status">): Availability {
  if (!tier || event.status === "draft") return ok;
  if (committed(tier) > 0) return no("Đã có vé giữ chỗ hoặc đã bán: giá bị khóa. Tạm dừng hạng này và tạo hạng giá mới.");
  if (tier.isActive) return no("Tạm dừng hạng vé trước khi đổi giá.");
  return ok;
}

/** Pause/resume exists only for published/ongoing Events. `activeOthers` = other active tiers. */
export function canToggleSales(tier: Tier, event: TierEvent, activeOthers: number, now: number): Availability {
  if (!ON_SALE.includes(event.status)) return no(event.status === "draft" ? "Bản nháp: bật/tắt trong form chỉnh sửa." : "Sự kiện không còn mở bán.");
  if (tier.isActive) {
    if (event.visibility === "visible" && activeOthers < 1) return no("Đây là hạng đang bán cuối cùng: ẩn sự kiện hoặc mở bán hạng khác trước.");
    return ok;
  }
  if (tier.capacity <= committed(tier)) return no("Hạng vé đã hết, không mở bán lại được.");
  const { end } = salesWindow(tier, event);
  if (Date.parse(event.endTime) <= now || (end && Date.parse(end) < now)) return no("Khung giờ bán đã kết thúc.");
  return ok;
}

export function canDeleteTier(tier: Tier, event: TierEvent, activeOthers: number): Availability {
  if (isReadOnly(event) || committed(tier) > 0) return no("Đã có đơn hoặc vé giữ chỗ: không xóa được, hãy tạm dừng.");
  if (event.status === "draft") return ok;
  if (tier.isActive) return no("Tạm dừng hạng vé trước khi xóa.");
  if (event.visibility === "visible" && activeOthers < 1) return no("Sự kiện đang hiển thị cần ít nhất một hạng đang bán.");
  return ok;
}

/* ---------- form ---------- */

export interface TierFormValues {
  name: string; description: string; price: string; capacity: string; maxPerOrder: string;
  customSales: boolean; salesStart: string; salesEnd: string; active: boolean;
}
export type TierFormField = keyof TierFormValues;
export interface TierFormError { field: TierFormField; message: string }

export const EMPTY_TIER_FORM: TierFormValues = { name: "", description: "", price: "", capacity: "", maxPerOrder: "4", customSales: false, salesStart: "", salesEnd: "", active: true };

const pad = (n: number) => String(n).padStart(2, "0");
export function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function tierFormFrom(tier: AdminTicketType): TierFormValues {
  return {
    name: tier.name, description: tier.description ?? "", price: String(tier.price), capacity: String(tier.capacity), maxPerOrder: String(tier.maxPerOrder),
    customSales: Boolean(tier.salesStartAt || tier.salesEndAt), salesStart: toLocalInput(tier.salesStartAt), salesEnd: toLocalInput(tier.salesEndAt), active: tier.isActive,
  };
}

/** Room this tier may take: unallocated seats plus what it already holds. */
export function capacityRoom(unallocated: number, editing: Pick<Tier, "capacity"> | null) {
  return unallocated + (editing?.capacity ?? 0);
}

export function capacityPreset(room: number, percent: number) {
  return Math.max(1, Math.floor(room * (percent / 100)));
}

export function validateTierForm(form: TierFormValues, ctx: { event: Pick<TierEvent, "status" | "endTime"> & { checkinEndAt?: string }; editing: Tier | null; unallocated: number }): TierFormError[] {
  const errors: TierFormError[] = [];
  const add = (field: TierFormField, message: string) => errors.push({ field, message });
  const price = Number(form.price);
  const capacity = Number(form.capacity);
  const max = Number(form.maxPerOrder);
  const { editing, event } = ctx;

  if (!form.name.trim()) add("name", "Tên hạng vé là bắt buộc.");
  else if (form.name.trim().length > 100) add("name", "Tên hạng vé tối đa 100 ký tự.");
  if (form.price === "" || !Number.isFinite(price) || price < 0) add("price", "Nhập giá vé (0 nếu miễn phí).");
  if (form.capacity === "" || !Number.isInteger(capacity) || capacity < 1) add("capacity", "Sức chứa phải là số nguyên dương.");
  else {
    if (editing && event.status !== "draft" && capacity < editing.capacity) add("capacity", "Không giảm sức chứa sau khi sự kiện đã công bố.");
    else if (editing && capacity < committed(editing)) add("capacity", `Không thấp hơn số vé đã giữ và đã bán (${committed(editing)}).`);
    if (capacity - (editing?.capacity ?? 0) > ctx.unallocated) add("capacity", `Chỉ còn ${ctx.unallocated.toLocaleString("vi-VN")} chỗ chưa phân bổ.`);
  }
  if (!Number.isInteger(max) || max < 1) add("maxPerOrder", "Số vé tối đa mỗi đơn phải ít nhất là 1.");
  else if (max > 100) add("maxPerOrder", "Số vé tối đa mỗi đơn không vượt quá 100.");
  if (form.customSales) {
    if (!form.salesStart) add("salesStart", "Chọn thời gian mở bán riêng.");
    if (!form.salesEnd) add("salesEnd", "Chọn thời gian kết thúc bán riêng.");
    if (form.salesStart && form.salesEnd && Date.parse(form.salesEnd) <= Date.parse(form.salesStart)) add("salesEnd", "Kết thúc bán phải sau thời gian mở bán.");
    if (form.salesEnd && Date.parse(form.salesEnd) > Date.parse(event.endTime)) add("salesEnd", "Không kết thúc bán sau khi sự kiện kết thúc.");
    else if (form.salesEnd && event.checkinEndAt && Date.parse(form.salesEnd) > Date.parse(event.checkinEndAt)) add("salesEnd", "Không kết thúc bán sau khi đóng check-in: khách mua sau giờ đó không vào cổng được.");
  }
  return errors;
}

export function tierPayload(form: TierFormValues, event: Pick<TierEvent, "status">, editing: Pick<Tier, "isActive"> | null) {
  const iso = (value: string) => (value ? new Date(value).toISOString() : null);
  return {
    name: form.name.trim(), description: form.description.trim() || null, price: Number(form.price), capacity: Number(form.capacity), maxPerOrder: Number(form.maxPerOrder),
    salesStartAt: form.customSales ? iso(form.salesStart) : null, salesEndAt: form.customSales ? iso(form.salesEnd) : null,
    // After publish the server keeps (edit) or forces paused (create); only Drafts set it here.
    isActive: event.status === "draft" ? form.active : editing?.isActive ?? false,
  };
}
