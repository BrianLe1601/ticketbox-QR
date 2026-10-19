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

/* ---------- fixed catalogue ---------- */

/**
 * The genre catalogue (reorderable, switchable) and legacy Categories kept only for the Events
 * that already use them. Legacy rows are shown apart and never mixed into the public order.
 */
export function splitCatalog<T extends Pick<AdminCategory, "catalog">>(items: readonly T[]): { genres: T[]; legacy: T[] } {
  return { genres: items.filter((item) => item.catalog), legacy: items.filter((item) => !item.catalog) };
}

const ERROR_TEXT: Record<string, string> = {
  CATEGORY_CATALOG_FIXED: "Danh sách thể loại là cố định; chỉ bật/tắt và sắp xếp được.",
  CATEGORY_LEGACY_READ_ONLY: "Danh mục cũ không bật lại được; hãy dùng một thể loại nhạc.",
  CATEGORY_NOT_FOUND: "Thể loại không còn tồn tại; hãy tải lại.",
};

/** Vietnamese message for a Category API error (codes are the contract, not the English text). */
export function categoryErrorText(error: unknown, fallback: string): string {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
  const message = error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return ERROR_TEXT[code] ?? (message || fallback);
}
