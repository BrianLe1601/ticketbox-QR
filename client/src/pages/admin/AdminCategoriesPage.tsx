import { ArrowRight, Clock3, FolderTree, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CategoryFormPanel } from "@/components/admin/categories/CategoryFormPanel";
import { CategoryList, type CategoryHandlers } from "@/components/admin/categories/CategoryList";
import {
  BentoCard, BentoGrid, Button, ButtonLink, ConfirmDialog, EmptyState, ErrorState, FilterBar, PageHeader, PageLayout, SkeletonBlock, notify,
  type FilterChip,
} from "@/components/admin/ui";
import { formatNumber, formatTime } from "@/lib/admin-format";
import {
  categoryErrorText, filterCategories, inDisplayOrder, moveItem, orderChanges, revertChanges, summarizeCategories,
  type CategoryStatusFilter, type OrderChange,
} from "@/lib/admin-category-view";
import { cn } from "@/lib/utils";
import { deleteAdminCategory, listAdminCategories, updateAdminCategory, type AdminCategory } from "@/services/admin-categories.service";
import { getPlatformSettings, type PlatformSettings } from "@/services/admin-platform-settings.service";
import "@/styles/admin/categories.css";

const STATUS: Array<{ value: CategoryStatusFilter; label: string; empty: string }> = [
  { value: "all", label: "Tổng danh mục", empty: "Chưa có danh mục nào" },
  { value: "active", label: "Đang hoạt động", empty: "Không có danh mục đang hoạt động" },
  { value: "inactive", label: "Đã vô hiệu hóa", empty: "Không có danh mục đã vô hiệu hóa" },
];

export function AdminCategoriesPage() {
  const [items, setItems] = useState<AdminCategory[]>([]);
  const [platform, setPlatform] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [at, setAt] = useState(0);
  const [status, setStatus] = useState<CategoryStatusFilter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusyState] = useState(false);
  // Toast "Hoàn tác" callbacks outlive the render that created them, so the guard reads a ref.
  const busyRef = useRef(false);
  const setBusy = (value: boolean) => { busyRef.current = value; setBusyState(value); };
  const [form, setForm] = useState<{ open: boolean; id: number | null; key: number }>({ open: false, id: null, key: 0 });
  const [removeTarget, setRemoveTarget] = useState<AdminCategory | null>(null);
  const [removeError, setRemoveError] = useState("");

  const load = useCallback((showError: boolean) => listAdminCategories(true).then(
    (data) => { setItems(data); setError(""); setAt(Date.now()); return true; },
    (cause: unknown) => { if (showError) setError(categoryErrorText(cause, "Không tải được danh mục.")); return false; },
  ).finally(() => setLoading(false)), []);

  useEffect(() => {
    void load(true);
    void getPlatformSettings().then(setPlatform).catch(() => {});
  }, [load]);

  const summary = useMemo(() => summarizeCategories(items), [items]);
  const ordered = useMemo(() => inDisplayOrder(items), [items]);
  const visible = useMemo(() => inDisplayOrder(filterCategories(items, status, query, "order")), [items, status, query]);
  const reorderable = status === "all" && !query.trim() && items.length > 1;
  const music = items.filter((item) => item.kind === "music").length;
  const selectable = items.filter((item) => item.selectableForNewEvent).length;
  const editing = form.id ? items.find((item) => item.id === form.id) ?? null : null;

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
      notify.error("Không lưu được thứ tự", { description: `${categoryErrorText(cause, "Lỗi máy chủ.")} Đã tải lại thứ tự hiện có trên máy chủ.` });
      await load(false);
    } finally {
      setBusy(false);
    }
  }

  function reorder(fromId: number, toId: number) {
    const changes = orderChanges(moveItem(ordered, fromId, toId));
    const name = items.find((item) => item.id === fromId)?.name ?? "danh mục";
    void applyOrder(changes, `Đã lưu thứ tự: ${name} ở vị trí ${moveItem(ordered, fromId, toId).findIndex((item) => item.id === fromId) + 1}`, revertChanges(changes));
  }

  async function toggle(item: AdminCategory, silent = false) {
    if (busyRef.current) return;
    setBusy(true);
    try {
      const saved = await updateAdminCategory(item.id, { isActive: !item.isActive });
      setItems((list) => list.map((entry) => (entry.id === saved.id ? saved : entry)));
      if (!silent) {
        notify.success(saved.isActive ? "Đã kích hoạt lại danh mục" : "Đã vô hiệu hóa danh mục", {
          description: saved.isActive ? saved.name : `${saved.name} · sự kiện đã có vẫn giữ danh mục này`,
          action: { label: "Hoàn tác", onClick: () => void toggle(saved, true) },
        });
      }
    } catch (cause) {
      notify.error("Không đổi được trạng thái", { description: categoryErrorText(cause, "Lỗi máy chủ.") });
    } finally {
      setBusy(false);
    }
  }

  const handlers: CategoryHandlers = {
    edit: (item) => setForm((current) => ({ open: true, id: item.id, key: current.key + 1 })),
    toggle: (item) => void toggle(item),
    remove: (item) => { setRemoveError(""); setRemoveTarget(item); },
    reorder,
    move: (item, offset) => {
      const index = ordered.findIndex((entry) => entry.id === item.id);
      const neighbour = ordered[index + offset];
      if (neighbour) reorder(item.id, neighbour.id);
    },
  };

  async function confirmRemove() {
    if (!removeTarget || busyRef.current) return;
    setBusy(true); setRemoveError("");
    try {
      await deleteAdminCategory(removeTarget.id);
      setItems((list) => list.filter((item) => item.id !== removeTarget.id));
      notify.success("Đã xóa danh mục", { description: removeTarget.name });
      setRemoveTarget(null);
    } catch (cause) {
      setRemoveError(categoryErrorText(cause, "Không xóa được danh mục."));
    } finally {
      setBusy(false);
    }
  }

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
        title="Danh mục"
        description="Thể loại âm nhạc của concert và thứ tự chúng hiện trên trang khách."
        meta={at ? <span className="tb-num"><Clock3 size={13} aria-hidden="true" /> Cập nhật lúc {formatTime(new Date(at), true)}</span> : null}
        actions={<>
          <Button icon={RefreshCw} disabled={busy} onClick={() => { void load(false).then((ok) => { if (!ok) notify.error("Không làm mới được"); }); }}>Làm mới</Button>
          <Button variant="primary" icon={Plus} disabled={loading || busy} onClick={() => setForm((current) => ({ open: true, id: null, key: current.key + 1 }))}>Thêm danh mục</Button>
        </>}
      />

      {error && items.length === 0 ? (
        <ErrorState title="Không tải được danh mục" description={error} onRetry={() => { setLoading(true); void load(true); }} retrying={loading} />
      ) : loading ? (
        <SkeletonBlock lines={6} label="Đang tải danh mục" />
      ) : (
        <BentoGrid>
          <BentoCard span={8} title="Thể loại" subtitle={reorderable ? "Kéo ⋮⋮ để đổi thứ tự hiển thị · lưu ngay, có hoàn tác" : "Bỏ lọc để đổi thứ tự hiển thị"}>
            <div className="cat-chips" role="group" aria-label="Lọc theo trạng thái">
              {STATUS.map((option) => {
                const count = option.value === "all" ? summary.total : option.value === "active" ? summary.active : summary.inactive;
                return (
                  <button key={option.value} type="button" className={cn("cat-chip", status === option.value && "is-active")} aria-pressed={status === option.value}
                    aria-label={option.value === "all" ? `Xem tất cả ${count} danh mục` : `Lọc ${count} danh mục ${option.label.toLowerCase()}`} onClick={() => selectStatus(option.value)}>
                    {option.label}<span className="cat-chip-count tb-num">{count}</span>
                  </button>
                );
              })}
            </div>
            <FilterBar label="Tìm danh mục" search={{ value: query, onChange: setQuery, placeholder: "Tìm theo tên, đường dẫn hoặc mô tả" }} chips={chips} onClearAll={() => selectStatus("all")}
              resultText={<span className="tb-num">{formatNumber(visible.length)} / {formatNumber(items.length)}</span>} />
            {visible.length === 0 ? (
              <EmptyState icon={FolderTree} title={query.trim() ? "Không có danh mục khớp từ khóa" : STATUS.find((s) => s.value === status)!.empty}
                description={items.length === 0 ? "Thêm thể loại âm nhạc đầu tiên để dùng khi tạo sự kiện." : undefined}
                action={chips.length ? <Button onClick={() => selectStatus("all")}>Xem tất cả ({items.length})</Button> : <Button variant="primary" icon={Plus} onClick={() => setForm((c) => ({ open: true, id: null, key: c.key + 1 }))}>Thêm danh mục</Button>} />
            ) : (
              <CategoryList items={visible} reorderable={reorderable} busy={busy} handlers={handlers} />
            )}
          </BentoCard>

          <BentoCard span={4} title="Tổng quan" subtitle="Trên toàn bộ danh mục">
            <dl className="cat-figures">
              <div><dt>Thể loại âm nhạc</dt><dd className="tb-num">{music}<small> / {summary.total}</small></dd></div>
              <div><dt>Chọn được cho sự kiện mới</dt><dd className="tb-num">{selectable}</dd></div>
              <div><dt>Sự kiện đang dùng danh mục</dt><dd className="tb-num">{formatNumber(summary.totalEvents)}</dd></div>
              <div><dt>Đã vô hiệu hóa</dt><dd className="tb-num">{summary.inactive}</dd></div>
            </dl>
            <div className="cat-scope">
              <span className="cat-scope-label">Phạm vi khi tạo sự kiện mới</span>
              <strong>{platform ? (platform.categoryScope === "all" ? "Mọi danh mục đang hoạt động" : "Chỉ thể loại âm nhạc") : "Chưa tải được cài đặt"}</strong>
              <ButtonLink to="/admin/settings" size="sm" variant="ghost" iconRight={ArrowRight}>Đổi tại Cài đặt</ButtonLink>
            </div>
            <ul className="cat-rules">
              <li>Thứ tự ở đây là thứ tự bộ lọc thể loại trên trang khách.</li>
              <li>Danh mục đã có sự kiện: đường dẫn bị khóa và không xóa được, chỉ vô hiệu hóa.</li>
              <li>Vô hiệu hóa không làm mất danh mục của sự kiện đã có.</li>
            </ul>
          </BentoCard>
        </BentoGrid>
      )}

      {form.open && (
        <CategoryFormPanel
          key={form.key}
          open={form.open}
          onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
          editing={editing}
          items={items}
          onSaved={(saved, created) => {
            setItems((list) => (created ? [...list, saved] : list.map((item) => (item.id === saved.id ? saved : item))));
            setForm((current) => ({ ...current, open: false }));
            notify.success(created ? "Đã tạo danh mục" : "Đã lưu danh mục", { description: saved.name });
            void load(false); // refresh server-derived fields (selectableForNewEvent)
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
        title="Xóa danh mục?"
        description={removeTarget ? `${removeTarget.name} (/${removeTarget.slug})` : undefined}
        consequences={["Xóa vĩnh viễn, không khôi phục được.", "Chỉ xóa được danh mục chưa có sự kiện; máy chủ kiểm tra lại."]}
        confirmLabel="Xóa danh mục"
        pending={busy && Boolean(removeTarget)}
        error={removeError}
        onConfirm={confirmRemove}
      />
    </PageLayout>
  );
}
