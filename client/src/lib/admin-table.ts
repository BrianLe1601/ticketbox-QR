/** Pure table logic (sort, paginate, select) shared by DataTable and its tests. */
export type SortDirection = "asc" | "desc";
export interface SortState { id: string; direction: SortDirection }
export type RowId = string | number;

const collator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

/** Stable sort; null/empty values always go last regardless of direction. */
export function sortRows<T>(rows: readonly T[], getValue: ((row: T) => string | number | null | undefined) | undefined, direction: SortDirection): T[] {
  if (!getValue) return [...rows];
  const factor = direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: getValue(row) }))
    .sort((a, b) => {
      const aEmpty = a.value === null || a.value === undefined || a.value === "";
      const bEmpty = b.value === null || b.value === undefined || b.value === "";
      if (aEmpty && bEmpty) return a.index - b.index;
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      const result = typeof a.value === "number" && typeof b.value === "number"
        ? a.value - b.value
        : collator.compare(String(a.value), String(b.value));
      return result === 0 ? a.index - b.index : result * factor;
    })
    .map((entry) => entry.row);
}

/** Next sort when a header is activated: asc -> desc -> none. */
export function nextSort(current: SortState | null, id: string): SortState | null {
  if (!current || current.id !== id) return { id, direction: "asc" };
  if (current.direction === "asc") return { id, direction: "desc" };
  return null;
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}

export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, Math.floor(page) || 1), pageCount(total, pageSize));
}

export function paginate<T>(rows: readonly T[], page: number, pageSize: number): T[] {
  const safe = clampPage(page, rows.length, pageSize);
  return rows.slice((safe - 1) * pageSize, safe * pageSize);
}

/** "Hiển thị 21–40 / 135" (or "Không có dòng nào"). */
export function rangeLabel(page: number, pageSize: number, total: number): string {
  if (total <= 0) return "Không có dòng nào";
  const safe = clampPage(page, total, pageSize);
  const from = (safe - 1) * pageSize + 1;
  const to = Math.min(total, safe * pageSize);
  const fmt = new Intl.NumberFormat("vi-VN");
  return `Hiển thị ${fmt.format(from)}–${fmt.format(to)} / ${fmt.format(total)}`;
}

/** Header checkbox state for the rows that can be selected on the current page. */
export function headerSelection(visibleIds: readonly RowId[], selected: ReadonlySet<RowId>): "none" | "some" | "all" {
  if (visibleIds.length === 0) return "none";
  const count = visibleIds.filter((id) => selected.has(id)).length;
  if (count === 0) return "none";
  return count === visibleIds.length ? "all" : "some";
}

/** Toggle all visible selectable rows, keeping selections on other pages. */
export function toggleVisible(visibleIds: readonly RowId[], selected: ReadonlySet<RowId>): Set<RowId> {
  const next = new Set(selected);
  if (headerSelection(visibleIds, selected) === "all") visibleIds.forEach((id) => next.delete(id));
  else visibleIds.forEach((id) => next.add(id));
  return next;
}

export function toggleOne(id: RowId, selected: ReadonlySet<RowId>): Set<RowId> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

/** Split a selection into rows an action may apply to and the rest ("3/5 đơn đủ điều kiện"). */
export function eligibility<T>(rows: readonly T[], isEligible: (row: T) => boolean) {
  const eligible = rows.filter(isEligible);
  return { eligible, ineligible: rows.filter((row) => !isEligible(row)), label: `${eligible.length}/${rows.length}` };
}
