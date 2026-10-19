import {
  CalendarClock, CalendarDays, CheckCircle2, Clock3, Columns3, FileEdit, LayoutGrid, List, Plus, Radio, RefreshCw, Send, XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { EventCalendar } from "@/components/admin/events/EventCalendar";
import { EventCard, EventCover } from "@/components/admin/events/EventCard";
import { EventDetailPanel } from "@/components/admin/events/EventDetailPanel";
import { EventFormPanel } from "@/components/admin/events/EventFormPanel";
import { EventKanban } from "@/components/admin/events/EventKanban";
import { eventMenuActions, type EventHandlers } from "@/components/admin/events/eventActions";
import {
  ActionMenu, BentoCard, BentoGrid, Button, ConfirmDialog, DataTable, EmptyState, ErrorState, Field, FilterBar, FilterSelect,
  KpiCard, KpiGrid, PageHeader, PageLayout, SegmentedControl, SkeletonBlock, StatusBadge, Textarea, notify,
  type Column, type FilterChip,
} from "@/components/admin/ui";
import { EVENT_LIFECYCLE_FALLBACK_REFRESH_MS } from "@/constants/eventconstants";
import { formatDateTime, formatNumber, formatTime } from "@/lib/admin-format";
import { eventCounts, filterEvents, monthOf, type MonthCursor, type StatusFilter } from "@/lib/admin-events-view";
import { statusStyle } from "@/lib/admin-status";
import { listAdminCategories, type AdminCategory } from "@/services/admin-categories.service";
import {
  cancelAdminEvent, deleteAdminEvent, listAdminEvents, publishAdminEvent, setAdminEventVisibility, type AdminEvent,
} from "@/services/admin-events.service";
import { getPlatformSettings, type PlatformSettings } from "@/services/admin-platform-settings.service";
import { subscribeToEventLifecycleUpdates } from "@/services/event-realtime.service";
import "@/styles/admin/events.css";

type ViewMode = "grid" | "list" | "calendar" | "kanban";
type Dialog =
  | { kind: "publish" | "hide" | "cancel" | "delete"; event: AdminEvent }
  | null;

const VIEW_KEY = "ticketbox-admin-events-view";
const VIEWS: ViewMode[] = ["grid", "list", "calendar", "kanban"];
const GRID_PAGE = 12;
const HIDE_MIN = 5;
const CANCEL_MIN = 10;

function readView(): ViewMode {
  try {
    const stored = window.localStorage.getItem(VIEW_KEY) as ViewMode | null;
    return stored && VIEWS.includes(stored) ? stored : "grid";
  } catch {
    return "grid";
  }
}

const KPI: Array<{ status: StatusFilter; label: string; hint: string; icon: typeof CalendarDays; tone: "neutral" | "primary" | "info" | "live" | "success" | "danger" }> = [
  { status: "all", label: "Tổng sự kiện", hint: "Bấm để xem tất cả", icon: CalendarDays, tone: "primary" },
  { status: "draft", label: "Bản nháp", hint: "Chưa công bố", icon: FileEdit, tone: "neutral" },
  { status: "published", label: "Đã công bố", hint: "Đang mở bán / chờ diễn ra", icon: Send, tone: "info" },
  { status: "ongoing", label: "Đang diễn ra", hint: "Đang mở cổng check-in", icon: Radio, tone: "live" },
  { status: "completed", label: "Đã kết thúc", hint: "Chỉ xem lịch sử", icon: CheckCircle2, tone: "success" },
  { status: "cancelled", label: "Đã hủy", hint: "Hoàn tiền mô phỏng", icon: XCircle, tone: "danger" },
];

const EMPTY_TITLE: Record<StatusFilter, string> = {
  all: "Chưa có sự kiện nào",
  draft: "Không có sự kiện bản nháp",
  published: "Không có sự kiện đã công bố",
  ongoing: "Không có sự kiện đang diễn ra",
  completed: "Không có sự kiện đã kết thúc",
  cancelled: "Không có sự kiện đã hủy",
};

export function AdminEventsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "all";
  const focusId = Number(searchParams.get("focus")) || null;

  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [platform, setPlatform] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [view, setView] = useState<ViewMode>(readView);
  const [page, setPage] = useState(1);
  const [cursor, setCursor] = useState<MonthCursor>(() => monthOf(new Date()));

  const [form, setForm] = useState<{ open: boolean; editingId: number | null; key: number }>({ open: false, editingId: null, key: 0 });
  // "?create=1" (setup guide) opens the create form once; the effect below then cleans the address.
  const createRequested = searchParams.get("create") === "1";
  const [createHandled, setCreateHandled] = useState(false);
  if (createRequested !== createHandled) {
    setCreateHandled(createRequested);
    if (createRequested) setForm((current) => ({ open: true, editingId: null, key: current.key + 1 }));
  }
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [dialogError, setDialogError] = useState("");

  /** Background refreshes keep the last good list; only the first load (or a retry) shows an error. */
  const load = useCallback((showError: boolean) => listAdminEvents().then(
    ({ data }) => { setEvents(data); setLoadError(""); setUpdatedAt(new Date()); return true; },
    (error: unknown) => { if (showError) setLoadError(error instanceof Error ? error.message : "Không thể tải sự kiện."); return false; },
  ).finally(() => setLoading(false)), []);

  const loadSettings = useCallback(() => {
    void listAdminCategories(false).then(setCategories).catch(() => {});
    void getPlatformSettings().then(setPlatform).catch(() => {});
  }, []);

  useEffect(() => {
    void load(true);
    loadSettings();
    const unsubscribe = subscribeToEventLifecycleUpdates(() => void load(false));
    const timer = window.setInterval(() => void load(false), EVENT_LIFECYCLE_FALLBACK_REFRESH_MS);
    return () => { unsubscribe(); window.clearInterval(timer); };
  }, [load, loadSettings]);

  useEffect(() => {
    try { window.localStorage.setItem(VIEW_KEY, view); } catch { /* view still works without storage */ }
  }, [view]);

  useEffect(() => {
    if (!createRequested) return;
    const params = new URLSearchParams(searchParams);
    params.delete("create");
    setSearchParams(params, { replace: true });
  }, [createRequested, searchParams, setSearchParams]);

  const counts = useMemo(() => eventCounts(events), [events]);
  const filtered = useMemo(() => filterEvents(events, { status, category, query }), [events, status, category, query]);
  const gridPages = Math.max(1, Math.ceil(filtered.length / GRID_PAGE));
  const gridPage = Math.min(page, gridPages);
  const gridRows = filtered.slice((gridPage - 1) * GRID_PAGE, gridPage * GRID_PAGE);
  const detail = focusId ? events.find((event) => event.id === focusId) ?? null : null;
  const editing = form.editingId ? events.find((event) => event.id === form.editingId) ?? null : null;
  const categoryName = (slug: string) => categories.find((item) => item.slug === slug)?.name ?? slug;

  function setCategory(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("category"); else params.set("category", next);
    setSearchParams(params, { replace: true });
    setPage(1);
  }

  function setFocus(id: number | null) {
    const params = new URLSearchParams(searchParams);
    if (id) params.set("focus", String(id)); else params.delete("focus");
    setSearchParams(params, { replace: !id });
  }

  function selectStatus(next: StatusFilter) {
    setStatus(next);
    setPage(1);
    // The total card restores the complete base scope.
    if (next === "all") { setQuery(""); setCategory("all"); }
  }

  function resetFilters() {
    setStatus("all"); setQuery(""); setPage(1);
    const params = new URLSearchParams(searchParams);
    params.delete("category");
    setSearchParams(params, { replace: true });
  }

  function replace(saved: AdminEvent) {
    setEvents((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
  }

  function openForm(editingId: number | null) {
    loadSettings();
    setFocus(null);
    setForm((current) => ({ open: true, editingId, key: current.key + 1 }));
  }

  function openDialog(kind: NonNullable<Dialog>["kind"], event: AdminEvent) {
    setReason(""); setDialogError(""); setDialog({ kind, event });
  }

  async function onToggleVisibility(event: AdminEvent) {
    if (event.visibility !== "hidden") { openDialog("hide", event); return; }
    try {
      replace(await setAdminEventVisibility(event.id, true));
      notify.success("Đã hiện sự kiện trên trang khách", { description: event.name });
    } catch (error) {
      notify.error("Không thể hiện sự kiện", { description: error instanceof Error ? error.message : undefined });
    }
  }

  const handlers: EventHandlers = {
    open: (event) => setFocus(event.id),
    edit: (event) => openForm(event.id),
    publish: (event) => openDialog("publish", event),
    toggleVisibility: (event) => void onToggleVisibility(event),
    cancel: (event) => openDialog("cancel", event),
    remove: (event) => openDialog("delete", event),
    go: (to) => navigate(to),
  };

  async function confirmDialog() {
    if (!dialog || pending) return;
    const { kind, event } = dialog;
    setPending(true); setDialogError("");
    try {
      if (kind === "publish") {
        replace(await publishAdminEvent(event.id));
        notify.success("Đã công bố sự kiện", { description: event.name });
      } else if (kind === "hide") {
        replace(await setAdminEventVisibility(event.id, false, reason.trim()));
        notify.success("Đã tạm ẩn sự kiện", { description: event.name });
      } else if (kind === "cancel") {
        const saved = await cancelAdminEvent(event.id, reason.trim());
        replace(saved);
        // Paid buyers now have simulated refund requests: offer the refund centre directly.
        notify.success("Đã hủy sự kiện", event.confirmedOrderCount > 0
          ? { description: `${event.name} · ${event.confirmedOrderCount} đơn đã thanh toán cần hoàn tiền mô phỏng`, action: { label: "Xử lý hoàn tiền", onClick: () => navigate("/admin/orders?view=refunds") }, persistent: true }
          : { description: `${event.name} · không có đơn đã thanh toán cần hoàn tiền` });
      } else {
        await deleteAdminEvent(event.id);
        setEvents((current) => current.filter((item) => item.id !== event.id));
        if (focusId === event.id) setFocus(null);
        notify.success("Đã xóa bản nháp", { description: event.name });
      }
      setDialog(null);
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "Thao tác không thành công.");
    } finally {
      setPending(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      loadSettings();
      if (!await load(false)) notify.error("Không làm mới được danh sách", { description: "Đang hiển thị dữ liệu lần tải trước." });
    } finally { setRefreshing(false); }
  }

  const chips: FilterChip[] = [
    ...(status !== "all" ? [{ id: "status", label: `Trạng thái: ${statusStyle("event", status).label}`, onRemove: () => selectStatus("all") }] : []),
    ...(category !== "all" ? [{ id: "category", label: `Thể loại: ${categoryName(category)}`, onRemove: () => setCategory("all") }] : []),
    ...(query.trim() ? [{ id: "query", label: `Từ khóa: “${query.trim()}”`, onRemove: () => setQuery("") }] : []),
  ];
  const filteredOut = chips.length > 0;

  const columns: Column<AdminEvent>[] = [
    {
      id: "name", header: "Sự kiện", sortValue: (row) => row.name,
      cell: (row) => (
        <span className="ev-cell-name">
          <EventCover event={row} className="ev-thumb" />
          <span className="ev-cell-text">
            <strong>{row.name}</strong>
            <span>{categoryName(row.category)}{row.visibility === "hidden" ? " · Đang ẩn" : ""}</span>
          </span>
        </span>
      ),
    },
    { id: "start", header: "Bắt đầu", nowrap: true, sortValue: (row) => new Date(row.startTime).getTime(), cell: (row) => <span className="tb-num">{formatDateTime(row.startTime)}</span> },
    { id: "status", header: "Trạng thái", sortValue: (row) => row.status, cell: (row) => <StatusBadge domain="event" status={row.status} size="sm" /> },
    { id: "sold", header: "Vé đã bán", align: "right", nowrap: true, hideable: true, sortValue: (row) => row.soldQuantity, cell: (row) => <span className="tb-num">{formatNumber(row.soldQuantity)} / {formatNumber(row.allocatedCapacity)}</span> },
    { id: "tiers", header: "Hạng vé hợp lệ", align: "right", hideable: true, sortValue: (row) => row.validTicketTypeCount, cell: (row) => <span className="tb-num">{row.validTicketTypeCount}/{row.ticketTypeCount}</span> },
    { id: "staff", header: "Nhân viên", align: "right", hideable: true, sortValue: (row) => row.activeStaffCount, cell: (row) => row.activeStaffCount ? <span className="tb-num">{row.activeStaffCount}</span> : <span className="ev-warn">Chưa có</span> },
    { id: "actions", header: <span className="sr-only">Thao tác</span>, label: "Thao tác", align: "right", cell: (row) => <ActionMenu label={`Thao tác cho ${row.name}`} actions={eventMenuActions(row, handlers)} /> },
  ];

  const emptyState = (
    <EmptyState
      icon={CalendarClock}
      title={query.trim() ? "Không tìm thấy sự kiện phù hợp" : category !== "all" && status === "all" ? "Không có sự kiện thuộc thể loại này" : EMPTY_TITLE[status]}
      description={query.trim() ? `Không có sự kiện nào khớp “${query.trim()}”${status !== "all" ? ` trong nhóm ${statusStyle("event", status).label}` : ""}.` : status === "all" && !filteredOut ? "Tạo bản nháp đầu tiên rồi thêm hạng vé để công bố." : undefined}
      action={filteredOut ? <Button onClick={resetFilters}>Xóa bộ lọc</Button> : <Button variant="primary" icon={Plus} onClick={() => openForm(null)}>Tạo bản nháp</Button>}
    />
  );

  const target = dialog?.event;
  return (
    <PageLayout className="evp">
      <PageHeader
        title="Sự kiện"
        description="Tạo, lên lịch, công bố và kết thúc concert tại địa điểm cố định."
        meta={updatedAt ? <span className="tb-num"><Clock3 size={13} aria-hidden="true" /> Cập nhật lúc {formatTime(updatedAt, true)} · tự cập nhật khi trạng thái đổi</span> : null}
        actions={<>
          <Button icon={RefreshCw} loading={refreshing} onClick={() => void onRefresh()}>Làm mới</Button>
          <Button variant="primary" icon={Plus} onClick={() => openForm(null)}>Tạo sự kiện</Button>
        </>}
      />

      <KpiGrid label="Lọc theo trạng thái sự kiện" className="evp-kpis">
        {KPI.map((item) => (
          <KpiCard
            key={item.status}
            label={item.label}
            value={formatNumber(counts[item.status])}
            hint={item.hint}
            icon={item.icon}
            tone={item.tone}
            loading={loading}
            selected={status === item.status}
            onClick={() => selectStatus(item.status)}
            ariaLabel={item.status === "all" ? `Xem tất cả ${counts.all} sự kiện` : `Lọc ${counts[item.status]} sự kiện ${item.label.toLowerCase()}`}
          />
        ))}
      </KpiGrid>

      <BentoGrid>
        <BentoCard
          span={12}
          title="Danh sách sự kiện"
          subtitle="Công bố cần ít nhất một hạng vé hợp lệ; sự kiện đã bán vé chỉ hủy được, không xóa."
          actions={
            <SegmentedControl<ViewMode>
              size="sm"
              ariaLabel="Chế độ hiển thị"
              value={view}
              onChange={(next) => { setView(next); setPage(1); }}
              options={[
                { value: "grid", label: "Dạng thẻ", icon: LayoutGrid },
                { value: "list", label: "Danh sách", icon: List },
                { value: "calendar", label: "Lịch", icon: CalendarDays },
                { value: "kanban", label: "Kanban", icon: Columns3 },
              ]}
            />
          }
        >
          <FilterBar
            label="Lọc sự kiện"
            search={{ value: query, onChange: (value) => { setQuery(value); setPage(1); }, placeholder: "Tìm theo tên, địa điểm hoặc thành phố" }}
            chips={chips}
            onClearAll={resetFilters}
            resultText={loading ? undefined : <span className="tb-num">{formatNumber(filtered.length)} / {formatNumber(events.length)} sự kiện</span>}
          >
            <FilterSelect label="Thể loại" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">Tất cả</option>
              {categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
            </FilterSelect>
          </FilterBar>

          {loadError && events.length === 0 ? (
            <ErrorState title="Không tải được danh sách sự kiện" description={loadError} onRetry={() => { setLoading(true); void load(true); }} retrying={loading} />
          ) : loading ? (
            <SkeletonBlock lines={6} label="Đang tải sự kiện" />
          ) : view === "list" ? (
            <DataTable
              caption="Danh sách sự kiện"
              columns={columns}
              rows={filtered}
              getRowId={(row) => row.id}
              onRowClick={(row) => setFocus(row.id)}
              rowActionLabel={(row) => `Xem chi tiết ${row.name}`}
              defaultSort={{ id: "start", direction: "desc" }}
              pagination={{ mode: "client", pageSize: 10 }}
              storageKey="admin-events"
              empty={emptyState}
            />
          ) : filtered.length === 0 && view !== "calendar" && view !== "kanban" ? (
            emptyState
          ) : view === "calendar" ? (
            <EventCalendar events={filtered} cursor={cursor} onCursorChange={setCursor} onOpen={handlers.open} />
          ) : view === "kanban" ? (
            <EventKanban events={filtered} handlers={handlers} onReject={(message) => notify.warning("Không đổi được trạng thái", { description: message })} />
          ) : (
            <>
              <ul className="ev-cards">{gridRows.map((event) => <li key={event.id}><EventCard event={event} handlers={handlers} /></li>)}</ul>
              {gridPages > 1 && (
                <nav className="adm-pagination" aria-label="Phân trang sự kiện">
                  <span className="adm-pagination-range tb-num" aria-live="polite">Hiển thị {(gridPage - 1) * GRID_PAGE + 1}–{Math.min(gridPage * GRID_PAGE, filtered.length)} / {filtered.length}</span>
                  <div className="adm-pagination-controls">
                    <Button size="sm" disabled={gridPage <= 1} onClick={() => setPage(gridPage - 1)}>Trước</Button>
                    <span className="adm-pagination-page tb-num">Trang {gridPage}/{gridPages}</span>
                    <Button size="sm" disabled={gridPage >= gridPages} onClick={() => setPage(gridPage + 1)}>Sau</Button>
                  </div>
                </nav>
              )}
            </>
          )}
        </BentoCard>
      </BentoGrid>

      <EventDetailPanel event={detail} open={Boolean(detail)} onOpenChange={(open) => { if (!open) setFocus(null); }} handlers={handlers} />

      {form.open && (
        <EventFormPanel
          key={form.key}
          open={form.open}
          onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
          editing={editing}
          categories={categories}
          platform={platform}
          onSaved={(saved, created) => {
            replace(saved);
            setForm((current) => ({ ...current, open: false }));
            notify.success(created ? "Đã lưu bản nháp" : "Đã lưu thay đổi", { description: saved.name });
            if (created) navigate(`/admin/ticket-types?eventId=${saved.id}&setup=1`);
          }}
        />
      )}

      <ConfirmDialog
        open={dialog?.kind === "publish"}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        tone="primary"
        title="Công bố sự kiện?"
        description={target?.name}
        consequences={[
          "Sự kiện hiện trên trang khách và mở bán theo khung giờ của từng hạng vé.",
          "Máy chủ kiểm tra lại điều kiện công bố trước khi đổi trạng thái.",
          "Sau khi công bố không đưa về bản nháp được; muốn dừng thì Ẩn hoặc Hủy.",
        ]}
        confirmLabel="Công bố"
        pending={pending}
        error={dialogError}
        onConfirm={confirmDialog}
      />

      <ConfirmDialog
        open={dialog?.kind === "hide"}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        tone="primary"
        title="Tạm ẩn sự kiện?"
        description={target?.name}
        consequences={["Sự kiện biến mất khỏi trang khách và mọi hạng vé tạm dừng bán.", "Đơn hàng và vé đã phát hành không thay đổi."]}
        confirmLabel="Ẩn sự kiện"
        pending={pending}
        error={dialogError}
        confirmDisabledReason={reason.trim().length < HIDE_MIN ? `Nhập lý do tối thiểu ${HIDE_MIN} ký tự` : undefined}
        onConfirm={confirmDialog}
      >
        <Field label="Lý do ẩn" required hint={`Tối thiểu ${HIDE_MIN} ký tự, lưu để truy vết quản trị.`}>
          {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Sự cố hoặc nội dung đang bảo trì…" />}
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === "cancel"}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        title="Hủy sự kiện?"
        description={<><strong>{target?.name}</strong>. Đây là trạng thái kết thúc, không mở lại được.</>}
        consequences={[
          "Ẩn sự kiện, dừng bán vé và thu hồi mọi phân công check-in đang hoạt động.",
          "Đơn chờ thanh toán được hủy và trả lại lượng vé giữ chỗ.",
          "Vé đã phát hành bị vô hiệu; đơn đã xác nhận được tạo bản ghi hoàn tiền mô phỏng (không chuyển tiền thật).",
          "Email thông báo hủy được đưa vào hàng đợi; lịch sử nghiệp vụ được giữ lại.",
        ]}
        confirmLabel="Hủy sự kiện"
        pending={pending}
        error={dialogError}
        confirmDisabledReason={reason.trim().length < CANCEL_MIN ? `Nhập lý do tối thiểu ${CANCEL_MIN} ký tự` : undefined}
        onConfirm={confirmDialog}
      >
        <Field label="Lý do hủy" required hint={`Tối thiểu ${CANCEL_MIN} ký tự · ${reason.trim().length}/500. Lưu vào lịch sử và gửi người mua.`}>
          {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do cụ thể để thông báo người mua…" />}
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        title="Xóa vĩnh viễn bản nháp?"
        description={target?.name}
        consequences={["Bản nháp cùng các hạng vé và phân công nhân viên của nó bị xóa, không khôi phục được.", "Chỉ xóa được khi chưa có đơn hàng; máy chủ kiểm tra lại."]}
        confirmLabel="Xóa bản nháp"
        pending={pending}
        error={dialogError}
        onConfirm={confirmDialog}
      />
    </PageLayout>
  );
}
