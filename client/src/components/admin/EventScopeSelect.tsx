import { Command } from "cmdk";
import { Check, ChevronsUpDown, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Popover } from "@/components/admin/ui";
import { useAuth } from "@/context/AuthContext";
import { formatDate, formatNumber } from "@/lib/admin-format";
import { statusStyle } from "@/lib/admin-status";
import { cn } from "@/lib/utils";
import { searchReportEvents, type ReportEvent } from "@/services/report.service";
import "@/styles/admin/event-scope.css";

/**
 * Event scope combobox for Nhật ký check-in and Báo cáo. The list is server-searched and paginated (every non-Draft
 * Event, terminal and zero-activity ones included), so cmdk filtering is off. "Tất cả sự kiện"
 * is always the first choice.
 */
export function EventScopeSelect({ value, label, onChange }: { value: string; label: string; onChange: (eventId: string, name: string) => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ReportEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchReportEvents(search.trim(), page, token, controller.signal)
        .then(({ data, meta }) => {
          if (controller.signal.aborted) return;
          setItems((current) => (page === 1 ? data : [...current, ...data]));
          setTotal(meta?.total ?? data.length);
          setError("");
        })
        .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được danh sách sự kiện."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, page === 1 ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, search, page, token, reload]);

  function toggle(next: boolean) {
    setOpen(next);
    if (next) { setLoading(true); setPage(1); }
  }
  function pick(id: string, name: string) { onChange(id, name); setOpen(false); }

  const remaining = Math.max(0, total - items.length);
  const current = value ? label || `Sự kiện #${value}` : "Tất cả sự kiện";

  return (
    <Popover
      open={open}
      onOpenChange={toggle}
      label="Chọn phạm vi sự kiện"
      className="es-select-pop"
      trigger={
        <button type="button" className="adm-filter-field es-trigger" aria-label={`Phạm vi sự kiện: ${current}. Bấm để đổi`}>
          <span className="adm-filter-field-label">Sự kiện</span>
          <span className="es-name">{current}</span>
          <ChevronsUpDown size={15} aria-hidden="true" />
        </button>
      }
    >
      <Command label="Chọn sự kiện" className="es-select" shouldFilter={false} loop>
        <div className="es-select-search">
          <Search size={15} aria-hidden="true" />
          <Command.Input autoFocus value={search} onValueChange={(next) => { setSearch(next); setPage(1); setLoading(true); }} placeholder="Tìm theo tên sự kiện…" maxLength={100} />
        </div>
        <Command.List className="es-select-list">
          <Command.Item value="__all" onSelect={() => pick("", "")} className={cn("es-select-item", !value && "is-current")}>
            <span className="es-select-check" aria-hidden="true">{!value && <Check size={15} />}</span>
            <span className="es-select-text"><span className="es-select-name">Tất cả sự kiện</span><span className="es-select-meta">Mọi sự kiện đã mở bán, gồm đã kết thúc và đã hủy</span></span>
          </Command.Item>
          {items.map((event) => (
            <Command.Item key={event.id} value={String(event.id)} onSelect={() => pick(String(event.id), event.name)} className={cn("es-select-item", String(event.id) === value && "is-current")}>
              <span className="es-select-check" aria-hidden="true">{String(event.id) === value && <Check size={15} />}</span>
              <span className="es-select-text">
                <span className="es-select-name">{event.name}</span>
                <span className="es-select-meta tb-num">{statusStyle("event", event.status).label}{event.startTime ? ` · ${formatDate(event.startTime)}` : ""}</span>
              </span>
            </Command.Item>
          ))}
        </Command.List>
        <div className="es-select-foot" aria-live="polite">
          {loading ? <span role="status">Đang tải…</span>
            : error ? <span className="es-select-error" role="alert">{error} <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => { setLoading(true); setError(""); setReload((n) => n + 1); }}>Thử lại</Button></span>
              : items.length === 0 ? <span>{search ? "Không có sự kiện khớp từ khóa." : "Chưa có sự kiện đã mở bán."}</span>
                : <span className="tb-num">{formatNumber(items.length)} / {formatNumber(total)} sự kiện</span>}
          {!loading && !error && remaining > 0 && (
            <Button size="sm" variant="ghost" onClick={() => { setLoading(true); setPage((n) => n + 1); }}>Tải thêm {Math.min(remaining, 20)}</Button>
          )}
        </div>
      </Command>
    </Popover>
  );
}
