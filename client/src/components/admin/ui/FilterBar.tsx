import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type ComponentPropsWithRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Popover } from "./Popover";

export interface FilterChip { id: string; label: string; onRemove: () => void }

export interface FilterBarProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    /** Delay before onChange fires while typing (default 200ms). No Enter needed. */
    debounceMs?: number;
    /** True while results for the latest query are loading (server search). */
    searching?: boolean;
  };
  /** Inline filters (FilterSelect / FilterDate); all share the same height and label style. */
  children?: ReactNode;
  /** Rarely used filters, grouped in a popover so the bar stays on one line. */
  advanced?: ReactNode;
  advancedCount?: number;
  chips?: FilterChip[];
  onClearAll?: () => void;
  /** e.g. "135 đơn" — announced politely when it changes. */
  resultText?: ReactNode;
  actions?: ReactNode;
  label?: string;
  className?: string;
}

function SearchInput({ value, onChange, placeholder, debounceMs = 200, searching }: NonNullable<FilterBarProps["search"]>) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  const timer = useRef<number | undefined>(undefined);

  // External resets (e.g. "Xóa lọc", selecting a KPI card) replace the draft.
  if (value !== synced) { setSynced(value); setDraft(value); }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function update(next: string, immediate = false) {
    setDraft(next);
    window.clearTimeout(timer.current);
    if (immediate) { setSynced(next); onChange(next); return; }
    timer.current = window.setTimeout(() => { setSynced(next); onChange(next); }, debounceMs);
  }

  const pending = draft !== value || searching;
  return (
    <div className="adm-filter-search">
      <Search className="adm-filter-search-icon" size={16} aria-hidden="true" />
      <input
        type="search"
        className="adm-control adm-filter-search-input"
        value={draft}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => update(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Escape" && draft) { event.preventDefault(); update("", true); } }}
      />
      {pending && draft && (
        <span className="adm-filter-search-status" role="status">
          <Loader2 size={14} aria-hidden="true" /><span>Đang tìm…</span>
        </span>
      )}
      {draft && !pending && (
        <button type="button" className="adm-filter-search-clear" onClick={() => update("", true)} aria-label="Xóa nội dung tìm kiếm">
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** One aligned row: search, inline filters, "Bộ lọc" popover, actions; then active chips. */
export function FilterBar({ search, children, advanced, advancedCount = 0, chips = [], onClearAll, resultText, actions, label = "Bộ lọc", className }: FilterBarProps) {
  return (
    <section className={cn("adm-filterbar", className)} aria-label={label}>
      <div className="adm-filterbar-row">
        {search && <SearchInput {...search} />}
        {children && <div className="adm-filterbar-fields">{children}</div>}
        {advanced && (
          <Popover
            label="Bộ lọc nâng cao"
            align="end"
            trigger={
              <Button icon={SlidersHorizontal} aria-label={advancedCount ? `Bộ lọc nâng cao, đang áp dụng ${advancedCount}` : "Bộ lọc nâng cao"}>
                Bộ lọc{advancedCount > 0 && <span className="adm-count-pill tb-num">{advancedCount}</span>}
              </Button>
            }
          >
            <div className="adm-filter-advanced">{advanced}</div>
          </Popover>
        )}
        {(resultText || actions) && (
          <div className="adm-filterbar-end">
            {resultText && <span className="adm-filterbar-result" aria-live="polite">{resultText}</span>}
            {actions}
          </div>
        )}
      </div>
      {chips.length > 0 && (
        <div className="adm-filterbar-chips">
          <span className="sr-only">Bộ lọc đang áp dụng:</span>
          <ul>
            {chips.map((chip) => (
              <li key={chip.id}>
                <span className="adm-chip">
                  {chip.label}
                  <button type="button" onClick={chip.onRemove} aria-label={`Bỏ lọc ${chip.label}`}><X size={12} aria-hidden="true" /></button>
                </span>
              </li>
            ))}
          </ul>
          {onClearAll && <Button size="sm" variant="ghost" onClick={onClearAll}>Xóa lọc</Button>}
        </div>
      )}
    </section>
  );
}

/** Select with its label inside the same 36px box, so every filter lines up. */
export function FilterSelect({ label, className, children, ...rest }: ComponentPropsWithRef<"select"> & { label: string }) {
  return (
    <label className={cn("adm-filter-field", className)}>
      <span className="adm-filter-field-label">{label}</span>
      <select className="adm-control adm-filter-field-control" {...rest}>{children}</select>
    </label>
  );
}

/** Date/datetime input with an inline label; same height as FilterSelect. */
export function FilterDate({ label, className, type = "date", ...rest }: ComponentPropsWithRef<"input"> & { label: string }) {
  return (
    <label className={cn("adm-filter-field", className)}>
      <span className="adm-filter-field-label">{label}</span>
      <input type={type} className="adm-control adm-filter-field-control" {...rest} />
    </label>
  );
}
