import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Rows3, Rows4 } from "lucide-react";
import { useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

import {
  clampPage, headerSelection, nextSort, pageCount, paginate, rangeLabel, sortRows, toggleOne, toggleVisible,
  type RowId, type SortState,
} from "@/lib/admin-table";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "./Button";
import { Checkbox } from "./Field";
import { CheckMenu } from "./Menu";
import { SegmentedControl } from "./Segmented";
import { Skeleton } from "./States";

export interface Column<T> {
  id: string;
  header: ReactNode;
  /** Plain-text name for menus and screen readers when `header` is not a string. */
  label?: string;
  cell: (row: T) => ReactNode;
  /** Enables client-side sorting on this column (or server sorting via onSortChange). */
  sortValue?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  width?: string;
  /** Can be hidden from the column menu (identity columns should not be). */
  hideable?: boolean;
  defaultHidden?: boolean;
  /** Keep this cell readable on narrow screens (no wrapping). */
  nowrap?: boolean;
}

export type Density = "comfortable" | "compact";

export type Pagination =
  | { mode: "client"; pageSize: number }
  | { mode: "server"; page: number; pageSize: number; total: number; onPageChange: (page: number) => void };

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => RowId;
  /** Visible caption for screen readers (what the table lists). */
  caption: string;
  loading?: boolean;
  /** Rendered instead of the body when there are no rows (and not loading). */
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Accessible name of the row action, e.g. (row) => `Xem đơn ${row.code}`. */
  rowActionLabel?: (row: T) => string;
  rowClassName?: (row: T) => string | undefined;
  selectedIds?: ReadonlySet<RowId>;
  onSelectionChange?: (next: Set<RowId>) => void;
  isRowSelectable?: (row: T) => boolean;
  /** Controlled sort; omit for internal client-side sort. With server pagination, sort on the server. */
  sort?: SortState | null;
  onSortChange?: (next: SortState | null) => void;
  defaultSort?: SortState | null;
  pagination?: Pagination;
  /** Left side of the table toolbar (e.g. result count). */
  toolbar?: ReactNode;
  /** Persist density and hidden columns in this browser (localStorage, guarded). */
  storageKey?: string;
  maxHeight?: string;
  className?: string;
}

interface StoredPrefs { density?: Density; hidden?: string[] }

function readPrefs(key?: string): StoredPrefs {
  if (!key) return {};
  try {
    const raw = window.localStorage.getItem(`ticketbox:table:${key}`);
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed ? parsed as StoredPrefs : {};
  } catch {
    return {};
  }
}

function writePrefs(key: string | undefined, prefs: StoredPrefs) {
  if (!key) return;
  try { window.localStorage.setItem(`ticketbox:table:${key}`, JSON.stringify(prefs)); } catch { /* preference only */ }
}

const INTERACTIVE = "button, a, input, select, textarea, label, [role='menuitem'], [role='checkbox'], [data-row-ignore]";

export function DataTable<T>({
  columns, rows, getRowId, caption, loading = false, empty, onRowClick, rowActionLabel, rowClassName,
  selectedIds, onSelectionChange, isRowSelectable, sort: controlledSort, onSortChange, defaultSort = null,
  pagination, toolbar, storageKey, maxHeight, className,
}: DataTableProps<T>) {
  const [prefs, setPrefs] = useState<StoredPrefs>(() => readPrefs(storageKey));
  const density: Density = prefs.density ?? "comfortable";
  const hidden = useMemo(
    () => new Set(prefs.hidden ?? columns.filter((column) => column.defaultHidden).map((column) => column.id)),
    [prefs.hidden, columns],
  );
  const [internalSort, setInternalSort] = useState<SortState | null>(defaultSort);
  const [internalPage, setInternalPage] = useState(1);
  const sort = controlledSort !== undefined ? controlledSort : internalSort;
  const serverMode = pagination?.mode === "server";

  function updatePrefs(next: StoredPrefs) {
    setPrefs(next);
    writePrefs(storageKey, next);
  }

  const visibleColumns = columns.filter((column) => !hidden.has(column.id));
  const selectable = Boolean(onSelectionChange && selectedIds);

  // Client mode sorts and pages here; server mode shows rows as given.
  const sortedRows = useMemo(() => {
    if (serverMode || !sort || onSortChange) return rows;
    const column = columns.find((item) => item.id === sort.id);
    return sortRows(rows, column?.sortValue, sort.direction);
  }, [rows, sort, columns, serverMode, onSortChange]);

  const total = serverMode ? (pagination as Extract<Pagination, { mode: "server" }>).total : sortedRows.length;
  const pageSize = pagination?.pageSize ?? Math.max(1, sortedRows.length);
  const page = serverMode
    ? (pagination as Extract<Pagination, { mode: "server" }>).page
    : clampPage(internalPage, sortedRows.length, pageSize);
  const pageRows = pagination && !serverMode ? paginate(sortedRows, page, pageSize) : sortedRows;
  const pages = pageCount(total, pageSize);

  function goTo(next: number) {
    const target = Math.min(Math.max(1, next), pages);
    if (serverMode) (pagination as Extract<Pagination, { mode: "server" }>).onPageChange(target);
    else setInternalPage(target);
  }

  function activateSort(column: Column<T>) {
    const next = nextSort(sort, column.id);
    if (onSortChange) onSortChange(next); else setInternalSort(next);
    if (!serverMode) setInternalPage(1);
  }

  const selectableIds = selectable ? pageRows.filter((row) => !isRowSelectable || isRowSelectable(row)).map(getRowId) : [];
  const headerState = selectable ? headerSelection(selectableIds, selectedIds!) : "none";

  function handleRowClick(event: MouseEvent<HTMLTableRowElement>, row: T) {
    if (!onRowClick) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    onRowClick(row);
  }

  function handleRowKey(event: KeyboardEvent<HTMLTableRowElement>, row: T) {
    if (!onRowClick || event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onRowClick(row); }
  }

  const hideableColumns = columns.filter((column) => column.hideable);
  const colSpan = visibleColumns.length + (selectable ? 1 : 0);
  const showEmpty = !loading && pageRows.length === 0;

  return (
    <div className={cn("adm-table-wrap", `is-${density}`, className)}>
      <div className="adm-table-toolbar">
        <div className="adm-table-toolbar-start">{toolbar}</div>
        <div className="adm-table-toolbar-end">
          <SegmentedControl<Density>
            size="sm"
            iconOnly
            ariaLabel="Mật độ bảng"
            value={density}
            onChange={(next) => updatePrefs({ ...prefs, density: next })}
            options={[{ value: "comfortable", label: "Thoáng", icon: Rows3 }, { value: "compact", label: "Gọn", icon: Rows4 }]}
          />
          {hideableColumns.length > 0 && (
            <CheckMenu
              label="Cột hiển thị"
              trigger={<IconButton icon={Columns3} label="Chọn cột hiển thị" size="sm" variant="secondary" noTooltip />}
              items={hideableColumns.map((column) => ({
                id: column.id,
                label: column.label ?? String(column.header),
                checked: !hidden.has(column.id),
                // Keep at least one hideable column visible.
                disabled: !hidden.has(column.id) && hideableColumns.filter((item) => !hidden.has(item.id)).length === 1,
                onCheckedChange: (checked) => {
                  const next = new Set(hidden);
                  if (checked) next.delete(column.id); else next.add(column.id);
                  updatePrefs({ ...prefs, hidden: [...next] });
                },
              }))}
            />
          )}
        </div>
      </div>

      <div className="adm-table-scroll" style={maxHeight ? { maxHeight } : undefined} tabIndex={0} role="region" aria-label={caption}>
        <table className="adm-table" aria-busy={loading || undefined} aria-rowcount={serverMode ? total + 1 : undefined}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className="adm-table-select">
                  <Checkbox
                    aria-label="Chọn tất cả dòng trên trang này"
                    checked={headerState === "all"}
                    indeterminate={headerState === "some"}
                    disabled={selectableIds.length === 0}
                    onChange={() => onSelectionChange!(toggleVisible(selectableIds, selectedIds!))}
                  />
                </th>
              )}
              {visibleColumns.map((column) => {
                const sortable = Boolean(column.sortValue || column.sortable);
                const active = sort?.id === column.id;
                const ariaSort = active ? (sort!.direction === "asc" ? "ascending" : "descending") : sortable ? "none" : undefined;
                const Icon = active ? (sort!.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th key={column.id} scope="col" aria-sort={ariaSort} className={cn(`is-${column.align ?? "left"}`)} style={column.width ? { width: column.width } : undefined}>
                    {sortable ? (
                      <button type="button" className={cn("adm-th-sort", active && "is-active")} onClick={() => activateSort(column)}>
                        <span>{column.header}</span>
                        <Icon size={13} aria-hidden="true" />
                      </button>
                    ) : column.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && pageRows.length === 0 && Array.from({ length: 5 }, (_, index) => (
              <tr key={`skeleton-${index}`} className="adm-table-skeleton" aria-hidden="true">
                {selectable && <td />}
                {visibleColumns.map((column) => <td key={column.id}><Skeleton width={index % 2 ? "70%" : "90%"} /></td>)}
              </tr>
            ))}
            {showEmpty && (
              <tr className="adm-table-empty"><td colSpan={colSpan}>{empty ?? "Không có dữ liệu"}</td></tr>
            )}
            {pageRows.map((row) => {
              const id = getRowId(row);
              const canSelect = selectable && (!isRowSelectable || isRowSelectable(row));
              const checked = selectable && selectedIds!.has(id);
              return (
                <tr
                  key={id}
                  className={cn(onRowClick && "is-clickable", checked && "is-selected", loading && "is-stale", rowClassName?.(row))}
                  onClick={(event) => handleRowClick(event, row)}
                  onKeyDown={(event) => handleRowKey(event, row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick && rowActionLabel ? rowActionLabel(row) : undefined}
                >
                  {selectable && (
                    <td className="adm-table-select">
                      <Checkbox
                        aria-label={rowActionLabel ? `Chọn: ${rowActionLabel(row)}` : "Chọn dòng"}
                        checked={checked}
                        disabled={!canSelect}
                        onChange={() => onSelectionChange!(toggleOne(id, selectedIds!))}
                      />
                    </td>
                  )}
                  {visibleColumns.map((column) => (
                    <td key={column.id} className={cn(`is-${column.align ?? "left"}`, column.nowrap && "is-nowrap")}>{column.cell(row)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination && total > 0 && (
        <nav className="adm-pagination" aria-label="Phân trang">
          <span className="adm-pagination-range tb-num" aria-live="polite">{rangeLabel(page, pageSize, total)}</span>
          <div className="adm-pagination-controls">
            <Button size="sm" icon={ChevronLeft} disabled={page <= 1 || loading} onClick={() => goTo(page - 1)} aria-label="Trang trước">Trước</Button>
            <span className="adm-pagination-page tb-num">Trang {page}/{pages}</span>
            <Button size="sm" iconRight={ChevronRight} disabled={page >= pages || loading} onClick={() => goTo(page + 1)} aria-label="Trang sau">Sau</Button>
          </div>
        </nav>
      )}
    </div>
  );
}
