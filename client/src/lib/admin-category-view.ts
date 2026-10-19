import type { AdminCategory } from "@/services/admin-categories.service";

export type CategoryStatusFilter = "all" | "active" | "inactive";
export type CategorySort = "order" | "name" | "events";

export function matchesCategoryStatus(item: AdminCategory, status: CategoryStatusFilter) {
  return status === "all" || (status === "active" ? item.isActive : !item.isActive);
}

export function summarizeCategories(items: AdminCategory[]) {
  const active = items.filter((item) => matchesCategoryStatus(item, "active")).length;
  return {
    total: items.length,
    active,
    inactive: items.length - active,
    totalEvents: items.reduce((total, item) => total + item.eventCount, 0),
  };
}

export function filterCategories(items: AdminCategory[], status: CategoryStatusFilter, search: string, sort: CategorySort) {
  const query = search.trim().toLocaleLowerCase("vi");
  return items.filter((item) => matchesCategoryStatus(item, status)
    && (!query || [item.name, item.slug, item.description ?? ""].some((value) => value.toLocaleLowerCase("vi").includes(query))))
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "vi", { sensitivity: "base" });
      if (sort === "events") return b.eventCount - a.eventCount || a.id - b.id;
      return a.sortOrder - b.sortOrder || a.id - b.id;
    });
}

/* ---------- ordering (drag to reorder) ---------- */

/** The list in display order (the order the public filters use). */
export function inDisplayOrder<T extends Pick<AdminCategory, "sortOrder" | "id" | "name">>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi", { sensitivity: "base" }) || a.id - b.id);
}

/** Move one item to another's position (both ids must be in the list). */
export function moveItem<T extends { id: number }>(items: readonly T[], fromId: number, toId: number): T[] {
  const from = items.findIndex((item) => item.id === fromId);
  const to = items.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0 || from === to) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export interface OrderChange { id: number; from: number; to: number }

/**
 * New sortOrder values for a reordered list: 10, 20, 30… (gaps leave room and stay ≤ 10000 up to
 * 1000 Categories). Only rows whose value changes are returned, so a save sends the fewest PATCHes.
 */
export function orderChanges(ordered: ReadonlyArray<Pick<AdminCategory, "id" | "sortOrder">>): OrderChange[] {
  return ordered.map((item, index) => ({ id: item.id, from: item.sortOrder, to: (index + 1) * 10 })).filter((change) => change.from !== change.to);
}

/** Undo plan: put every changed row back to its previous value. */
export function revertChanges(changes: readonly OrderChange[]): OrderChange[] {
  return changes.map((change) => ({ id: change.id, from: change.to, to: change.from }));
}

/** sortOrder for a new Category: after the current last one. */
export function nextSortOrder(items: ReadonlyArray<Pick<AdminCategory, "sortOrder">>): number {
  return Math.min(10000, items.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 10);
}

/* ---------- form ---------- */

/** "Nhạc Trữ Tình & Bolero" -> "nhac-tru-tinh-bolero" (server: ^[a-z0-9]+(-[a-z0-9]+)*$). */
export function slugify(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100).replace(/-+$/g, "");
}

export interface CategoryFormValues { name: string; slug: string; description: string; icon: string; kind: "music" | "other"; isActive: boolean }
export type CategoryFormField = keyof CategoryFormValues;

export function validateCategoryForm(form: CategoryFormValues, others: ReadonlyArray<Pick<AdminCategory, "name" | "slug">>): Partial<Record<CategoryFormField, string>> {
  const errors: Partial<Record<CategoryFormField, string>> = {};
  const name = form.name.trim();
  const slug = form.slug.trim();
  const same = (a: string, b: string) => a.localeCompare(b, "vi", { sensitivity: "base" }) === 0;
  if (name.length < 2 || name.length > 100) errors.name = "Tên cần 2–100 ký tự.";
  else if (others.some((item) => same(item.name, name))) errors.name = "Đã có danh mục cùng tên.";
  if (slug.length < 2 || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.slug = "Chỉ chữ thường không dấu, số và dấu gạch nối (ví dụ: nhac-acoustic), 2–100 ký tự.";
  else if (others.some((item) => item.slug === slug)) errors.slug = "Đường dẫn này đã được dùng.";
  if (form.description.trim().length > 500) errors.description = "Mô tả tối đa 500 ký tự.";
  if (form.icon.trim().length > 50) errors.icon = "Mã biểu tượng tối đa 50 ký tự.";
  return errors;
}

const ERROR_TEXT: Record<string, string> = {
  CATEGORY_CONFLICT: "Tên hoặc đường dẫn đã tồn tại.",
  CATEGORY_SLUG_IN_USE: "Đường dẫn đã có sự kiện dùng nên không đổi được.",
  CATEGORY_IN_USE: "Danh mục đang có sự kiện, không xóa được; hãy vô hiệu hóa.",
  CATEGORY_NOT_FOUND: "Danh mục không còn tồn tại; hãy tải lại.",
};

/** Vietnamese message for a Category API error (codes are the contract, not the English text). */
export function categoryErrorText(error: unknown, fallback: string): string {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
  const message = error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return ERROR_TEXT[code] ?? (message || fallback);
}
