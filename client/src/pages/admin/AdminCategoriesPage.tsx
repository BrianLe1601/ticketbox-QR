import { Archive, Clock3, ListMusic, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CategoryList, LegacyCategoryList, type CategoryHandlers } from "@/components/admin/categories/CategoryList";
import {
  BentoCard, BentoGrid, Button, EmptyState, ErrorState, FilterBar, PageHeader, PageLayout, SkeletonBlock, notify,
  type FilterChip,
} from "@/components/admin/ui";
import { formatNumber, formatTime } from "@/lib/admin-format";
import {
  categoryErrorText, filterCategories, inDisplayOrder, moveItem, orderChanges, revertChanges, splitCatalog, summarizeCategories,
  type CategoryStatusFilter, type OrderChange,
} from "@/lib/admin-category-view";
import { cn } from "@/lib/utils";
import { listAdminCategories, updateAdminCategory, type AdminCategory } from "@/services/admin-categories.service";
import "@/styles/admin/categories.css";

const STATUS: Array<{ value: CategoryStatusFilter; label: string; empty: string }> = [
  { value: "all", label: "Tổng thể loại", empty: "Chưa có thể loại nào" },
  { value: "active", label: "Đang bật", empty: "Chưa bật thể loại nào" },
  { value: "inactive", label: "Đã tắt", empty: "Không có thể loại nào đang tắt" },
];

export function AdminCategoriesPage() {
  const [items, setItems] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [at, setAt] = useState(0);
  const [status, setStatus] = useState<CategoryStatusFilter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusyState] = useState(false);
  // Toast "Hoàn tác" callbacks outlive the render that created them, so the guard reads a ref.
  const busyRef = useRef(false);
  const setBusy = (value: boolean) => { busyRef.current = value; setBusyState(value); };

  const load = useCallback((showError: boolean) => listAdminCategories(true).then(
    (data) => { setItems(data); setError(""); setAt(Date.now()); return true; },
    (cause: unknown) => { if (showError) setError(categoryErrorText(cause, "Không tải được thể loại.")); return false; },
  ).finally(() => setLoading(false)), []);

  useEffect(() => { void load(true); }, [load]);

  const { genres, legacy: allLegacy } = useMemo(() => splitCatalog(items), [items]);
  // Legacy rows matter only while an Event uses them or buyers still see them.
  const legacy = useMemo(() => allLegacy.filter((item) => item.eventCount > 0 || item.isActive), [allLegacy]);
  const summary = useMemo(() => summarizeCategories(genres), [genres]);
  const ordered = useMemo(() => inDisplayOrder(genres), [genres]);
  const visible = useMemo(() => inDisplayOrder(filterCategories(genres, status, query, "order")), [genres, status, query]);
  const reorderable = status === "all" && !query.trim() && genres.length > 1;
  const legacyEvents = legacy.reduce((total, item) => total + item.eventCount, 0);

  /** PATCH each changed sortOrder in turn. A failure part-way reloads the server order (no batch API). */
  async function applyOrder(changes: OrderChange[], done: string, undo?: OrderChange[]) {
    if (!changes.length || busyRef.current) return;
    const previous = items;
    setItems((list) => list.map((item) => { const change = changes.find((entry) => entry.id === item.id); return change ? { ...item, sortOrder: change.to } : item; }));
    setBusy(true);
    try {
      for (const change of changes) await updateAdminCategory(change.id, { sortOrder: change.to });
      notify.success(done, undo ? { action: { label: "Hoàn tác", onClick: () => void applyOrder(undo, "Đã hoàn tác thứ tự") } } : undefined);
    } catch (cause) {
      setItems(previous);
      notify.error("Không lưu được thứ tự", { description: `${categoryErrorText(cause, "Lỗi máy chủ.")} Đã tải lại thứ tự hiện tại.` });
      await load(false);
    } finally {
      setBusy(false);
    }
  }

  function reorder(fromId: number, toId: number) {
    const next = moveItem(ordered, fromId, toId);
    const changes = orderChanges(next);
    const name = items.find((item) => item.id === fromId)?.name ?? "thể loại";
    void applyOrder(changes, `Đã lưu thứ tự: ${name} ở vị trí ${next.findIndex((item) => item.id === fromId) + 1}`, revertChanges(changes));
  }

  async function setActive(item: AdminCategory, isActive: boolean, silent = false) {
    if (busyRef.current) return;
    setBusy(true);
    try {
      const saved = await updateAdminCategory(item.id, { isActive });
      setItems((list) => list.map((entry) => (entry.id === saved.id ? saved : entry)));
      if (!silent) {
        notify.success(saved.isActive ? `Đã bật ${saved.name}` : `Đã tắt ${saved.name}`, {
          description: saved.isActive ? "Chọn được khi tạo sự kiện và hiện trong bộ lọc của khách." : "Sự kiện đã có vẫn giữ thể loại này.",
          // A legacy Category cannot be switched back on, so only genres offer undo.
          ...(saved.catalog ? { action: { label: "Hoàn tác", onClick: () => void setActive(saved, !saved.isActive, true) } } : {}),
        });
      }
    } catch (cause) {
      notify.error("Không đổi được trạng thái", { description: categoryErrorText(cause, "Lỗi máy chủ.") });
    } finally {
      setBusy(false);
    }
  }

  const handlers: CategoryHandlers = {
    toggle: (item) => void setActive(item, !item.isActive),
    reorder,
    move: (item, offset) => {
      const index = ordered.findIndex((entry) => entry.id === item.id);
      const neighbour = ordered[index + offset];
      if (neighbour) reorder(item.id, neighbour.id);
    },
  };

  function selectStatus(next: CategoryStatusFilter) {
    setStatus(next);
    if (next === "all") setQuery(""); // the total restores the complete list
  }

  const chips: FilterChip[] = [
    ...(status !== "all" ? [{ id: "status", label: `Trạng thái: ${STATUS.find((s) => s.value === status)?.label}`, onRemove: () => selectStatus("all") }] : []),
    ...(query.trim() ? [{ id: "query", label: `Từ khóa: “${query.trim()}”`, onRemove: () => setQuery("") }] : []),
  ];

  return (
    <PageLayout className="catp">
      <PageHeader
        title="Thể loại nhạc"
        description="Bật những thể loại địa điểm của bạn tổ chức và sắp xếp thứ tự chúng hiện trên trang mua vé."
        meta={at ? <span className="tb-num"><Clock3 size={13} aria-hidden="true" /> Cập nhật lúc {formatTime(new Date(at), true)}</span> : null}
        actions={<Button icon={RefreshCw} disabled={busy} onClick={() => { void load(false).then((ok) => { if (!ok) notify.error("Không làm mới được"); }); }}>Làm mới</Button>}
      />

      {error && items.length === 0 ? (
        <ErrorState title="Không tải được thể loại" description={error} onRetry={() => { setLoading(true); void load(true); }} retrying={loading} />
      ) : loading ? (
        <SkeletonBlock lines={6} label="Đang tải thể loại" />
      ) : (
        <BentoGrid>
          <BentoCard span={8} title="Thể loại" subtitle={reorderable ? "Kéo ⋮⋮ để đổi thứ tự hiển thị · lưu ngay, có hoàn tác" : "Bỏ lọc để đổi thứ tự hiển thị"}>
            <div className="cat-chips" role="group" aria-label="Lọc theo trạng thái">
              {STATUS.map((option) => {
                const count = option.value === "all" ? summary.total : option.value === "active" ? summary.active : summary.inactive;
                return (
                  <button key={option.value} type="button" className={cn("cat-chip", status === option.value && "is-active")} aria-pressed={status === option.value}
                    aria-label={option.value === "all" ? `Xem tất cả ${count} thể loại` : `Lọc ${count} thể loại ${option.label.toLowerCase()}`} onClick={() => selectStatus(option.value)}>
                    {option.label}<span className="cat-chip-count tb-num">{count}</span>
                  </button>
                );
              })}
            </div>
            <FilterBar label="Tìm thể loại" search={{ value: query, onChange: setQuery, placeholder: "Tìm theo tên hoặc mô tả" }} chips={chips} onClearAll={() => selectStatus("all")}
              resultText={<span className="tb-num">{formatNumber(visible.length)} / {formatNumber(genres.length)}</span>} />
            {visible.length === 0 ? (
              <EmptyState icon={ListMusic} title={query.trim() ? "Không có thể loại khớp từ khóa" : STATUS.find((s) => s.value === status)!.empty}
                action={chips.length ? <Button onClick={() => selectStatus("all")}>Xem tất cả ({genres.length})</Button> : undefined} />
            ) : (
              <CategoryList items={visible} reorderable={reorderable} busy={busy} handlers={handlers} />
            )}
          </BentoCard>

          <BentoCard span={4} title="Tổng quan" subtitle="Danh sách thể loại của TicketBox">
            <dl className="cat-figures">
              <div><dt>Đang bật</dt><dd className="tb-num">{summary.active}<small> / {summary.total}</small></dd></div>
              <div><dt>Sự kiện theo thể loại</dt><dd className="tb-num">{formatNumber(summary.totalEvents)}</dd></div>
            </dl>
            {summary.total > 0 && summary.active === 0 && (
              <p className="cat-warn" role="status">Chưa bật thể loại nào: hãy bật ít nhất một thể loại để tạo sự kiện mới.</p>
            )}
            <ul className="cat-rules">
              <li>Thể loại đang bật chọn được khi tạo sự kiện và hiện trong bộ lọc của khách, theo thứ tự ở đây.</li>
              <li>Tắt một thể loại không ảnh hưởng sự kiện đã có.</li>
              <li>Danh sách thể loại là cố định. Thể loại chưa có trong danh sách hãy chọn “Thể loại nhạc khác”.</li>
            </ul>
          </BentoCard>

          {legacy.length > 0 && (
            <BentoCard span={12} title="Danh mục cũ" subtitle={`Giữ lại cho ${formatNumber(legacyEvents)} sự kiện đã tạo trước đây · không dùng được cho sự kiện mới`}
              actions={<Archive size={18} aria-hidden="true" className="cat-legacy-icon" />}>
              <LegacyCategoryList items={legacy} busy={busy} onTurnOff={(item) => void setActive(item, false)} />
            </BentoCard>
          )}
        </BentoGrid>
      )}
    </PageLayout>
  );
}
