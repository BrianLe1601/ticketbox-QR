/**
 * Pure helpers for the Admin "Cài đặt" page. They only give early feedback: the server re-checks
 * every rule (platform-settings venueSchema, auth changeAdminPasswordSchema).
 */
import type { PlatformSettings, VenueSettings } from "@/services/admin-platform-settings.service";

export type SettingsTab = "system" | "appearance" | "account";
export const SETTINGS_TABS: Array<{ value: SettingsTab; label: string }> = [
  { value: "system", label: "Hệ thống" },
  { value: "appearance", label: "Giao diện" },
  { value: "account", label: "Tài khoản" },
];
export const tabFromParam = (value: string | null): SettingsTab =>
  value === "appearance" || value === "account" ? value : "system";

/* ---------- venue ---------- */

export interface VenueForm { name: string; address: string; city: string; capacity: string }
export const EMPTY_VENUE: VenueForm = { name: "", address: "", city: "", capacity: "" };
export const MAX_VENUE_CAPACITY = 1_000_000;

export const venueFormOf = (venue: VenueSettings | null): VenueForm =>
  venue ? { name: venue.name, address: venue.address, city: venue.city, capacity: String(venue.capacity) } : { ...EMPTY_VENUE };

/** True when the form differs from what the server holds (always true while no venue exists). */
export function venueDirty(saved: VenueSettings | null, form: VenueForm) {
  if (!saved) return true;
  return saved.name !== form.name.trim() || saved.address !== form.address.trim()
    || saved.city !== form.city.trim() || String(saved.capacity) !== form.capacity.trim();
}

export type VenueField = keyof VenueForm;
export function validateVenue(form: VenueForm): Partial<Record<VenueField, string>> {
  const errors: Partial<Record<VenueField, string>> = {};
  if (!form.name.trim()) errors.name = "Nhập tên địa điểm.";
  if (!form.address.trim()) errors.address = "Nhập địa chỉ.";
  if (!form.city.trim()) errors.city = "Nhập thành phố.";
  const capacity = Number(form.capacity);
  if (!form.capacity.trim()) errors.capacity = "Nhập sức chứa tối đa.";
  else if (!Number.isInteger(capacity) || capacity < 1) errors.capacity = "Sức chứa phải là số nguyên từ 1 trở lên.";
  else if (capacity > MAX_VENUE_CAPACITY) errors.capacity = "Sức chứa tối đa là 1.000.000 chỗ.";
  return errors;
}

export const venuePayload = (form: VenueForm): VenueSettings =>
  ({ name: form.name.trim(), address: form.address.trim(), city: form.city.trim(), capacity: Number(form.capacity) });

/** What saving the venue does to existing Events, for the confirmation line under the form. */
export function venueImpact(settings: Pick<PlatformSettings, "venue" | "outOfSyncEventCount">, form: VenueForm) {
  if (!settings.venue) return "Sau khi lưu, có thể tạo sự kiện mới; mỗi sự kiện mới tự lấy địa điểm này.";
  const capacityDown = Number(form.capacity) < settings.venue.capacity;
  return `Chỉ áp dụng cho sự kiện tạo sau khi lưu; sự kiện đã có giữ địa điểm cũ.${capacityDown ? " Sức chứa giảm không làm giảm số vé của sự kiện đã tạo." : ""}`;
}

/* ---------- genre catalogue ---------- */

interface CategoryLike { isActive: boolean; catalog: boolean }

/** Catalogue genres switched on (usable for new Events) out of the whole fixed catalogue. */
export function genreCounts(categories: readonly CategoryLike[]) {
  const genres = categories.filter((item) => item.catalog);
  const active = genres.filter((item) => item.isActive).length;
  return { active, off: genres.length - active, total: genres.length };
}

/* ---------- password ---------- */

export interface PasswordCheck { id: "length" | "lower" | "digit" | "special" | "different"; label: string; ok: boolean }

/** The server's password rules, as a live checklist. */
export function passwordChecks(next: string, current: string): PasswordCheck[] {
  return [
    { id: "length", label: "8–100 ký tự", ok: next.length >= 8 && next.length <= 100 },
    { id: "lower", label: "Có chữ thường (a–z)", ok: /[a-z]/.test(next) },
    { id: "digit", label: "Có chữ số (0–9)", ok: /[0-9]/.test(next) },
    { id: "special", label: "Có ký tự đặc biệt (@, *, #…)", ok: /[^\p{L}\p{N}\s]/u.test(next) },
    { id: "different", label: "Khác mật khẩu hiện tại", ok: next.length > 0 && next !== current },
  ];
}

export function passwordFormErrors(form: { current: string; next: string; confirm: string }) {
  const errors: Partial<Record<"current" | "next" | "confirm", string>> = {};
  if (form.current.length < 8) errors.current = "Nhập mật khẩu hiện tại (ít nhất 8 ký tự).";
  if (passwordChecks(form.next, form.current).some((check) => !check.ok)) errors.next = "Mật khẩu mới chưa đạt đủ các yêu cầu bên dưới.";
  if (!form.confirm) errors.confirm = "Nhập lại mật khẩu mới.";
  else if (form.confirm !== form.next) errors.confirm = "Xác nhận chưa khớp mật khẩu mới.";
  return errors;
}

export function profileError(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2) return "Họ tên phải có ít nhất 2 ký tự.";
  if (trimmed.length > 100) return "Họ tên tối đa 100 ký tự.";
  return "";
}
