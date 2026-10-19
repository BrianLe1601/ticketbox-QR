import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type Announcements, type DragEndEvent, type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { Clock3, GripVertical, RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { EventColumn } from "@/components/admin/staff/EventColumn";
import { StaffPanel } from "@/components/admin/staff/StaffPanel";
import { StaffTable, type StaffHandlers } from "@/components/admin/staff/StaffTable";
import {
  Avatar, BentoCard, BentoGrid, Button, ConfirmDialog, EmptyState, ErrorState, FilterBar, Notice, PageHeader, PageLayout,
  SkeletonBlock, notify, type FilterChip,
} from "@/components/admin/ui";
import { formatDateTime, formatNumber, formatTime } from "@/lib/admin-format";
import {
  ACTION_LABEL, STAFF_SEGMENTS, assignableEvents, canAssign, filterStaff, segmentCounts, segmentFromParam,
  type StaffAction, type StaffSegment,
} from "@/lib/admin-staff";
import { statusStyle } from "@/lib/admin-status";
import { cn } from "@/lib/utils";
import type { AdminEvent } from "@/services/admin-events.service";
import {
  assignAdminStaff, editAdminStaff, formatStaffErrorMessage, listAdminStaff, listStaffAssignableEvents,
  revokeAdminStaffAssignment, setAdminStaffStatus, type AdminStaff, type StaffAssignment,
} from "@/services/admin-staff.service";
import "@/styles/admin/staff.css";

const PAGE_SIZE = 10;
const SEGMENT_LABEL: Record<StaffSegment, string> = { all: "Tất cả", pending: "Chờ duyệt", active: "Đang hoạt động", inactive: "Đã vô hiệu hóa", rejected: "Đã từ chối" };
const EMPTY: Record<StaffSegment, string> = {
  all: "Chưa có tài khoản nhân viên", pending: "Không có tài khoản chờ duyệt", active: "Không có nhân viên đang hoạt động",
  inactive: "Không có tài khoản bị vô hiệu hóa", rejected: "Không có tài khoản bị từ chối",
};

type Dialog =
  | { kind: "status"; person: AdminStaff; action: StaffAction }
  | { kind: "assign"; person: AdminStaff; event: AdminEvent }
  | { kind: "revoke"; person: AdminStaff; assignment: StaffAssignment }
  | null;

const STATUS_COPY: Record<StaffAction, { title: string; confirm: string; tone: "primary" | "danger"; points: string[]; done: string }> = {
  approve: { title: "Duyệt tài khoản nhân viên?", confirm: "Duyệt", tone: "primary", done: "Đã duyệt tài khoản", points: ["Tài khoản được kích hoạt quyền nhân viên và đăng nhập được bằng Google.", "Duyệt không tự gán sự kiện; phân công riêng sau đó."] },
  reject: { title: "Từ chối yêu cầu?", confirm: "Từ chối", tone: "danger", done: "Đã từ chối yêu cầu", points: ["Tài khoản chuyển sang Đã từ chối và không đăng nhập được.", "Mọi phân công (nếu có) bị thu hồi; vẫn duyệt lại được sau này."] },
  deactivate: { title: "Vô hiệu hóa nhân viên?", confirm: "Vô hiệu hóa", tone: "danger", done: "Đã vô hiệu hóa tài khoản", points: ["Mọi phân công đang hoạt động bị thu hồi ngay.", "Mọi phiên đăng nhập bị hủy; không check-in được tại cổng.", "Lịch sử quét và phân công cũ được giữ để kiểm toán."] },
  reactivate: { title: "Kích hoạt lại nhân viên?", confirm: "Kích hoạt lại", tone: "primary", done: "Đã kích hoạt lại tài khoản", points: ["Nhân viên đăng nhập lại được.", "Phân công cũ không tự khôi phục; gán sự kiện mới nếu cần."] },
};

/** Keyboard dragging moves between the Event drop targets with ↑/↓ (they form one column). */
const eventCoordinates: KeyboardCoordinateGetter = (event, { context: { collisionRect, droppableRects, droppableContainers } }) => {
  if (!collisionRect || !["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.code)) return undefined;
  event.preventDefault();
  const rects = droppableContainers.getEnabled().map((item) => droppableRects.get(item.id)).filter((rect): rect is NonNullable<typeof rect> => Boolean(rect)).sort((a, b) => a.top - b.top);
  if (!rects.length) return undefined;
  const center = collisionRect.top + collisionRect.height / 2;
  const current = rects.findIndex((rect) => center >= rect.top && center <= rect.top + rect.height);
  const forward = event.code === "ArrowDown" || event.code === "ArrowRight";
  const next = rects[current < 0 ? 0 : Math.min(rects.length - 1, Math.max(0, current + (forward ? 1 : -1)))];
  return { x: next.left + next.width / 2 - collisionRect.width / 2, y: next.top + next.height / 2 - collisionRect.height / 2 };
};

export function AdminStaffPage() {
  const [params, setParams] = useSearchParams();
  const eventFilter = Number(params.get("eventId")) || null;
  const focusId = Number(params.get("focus")) || null;
  const assignTargetId = Number(params.get("assignEvent")) || null;

  const [people, setPeople] = useState<AdminStaff[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [at, setAt] = useState(0);
  const [segment, setSegment] = useState<StaffSegment>(() => segmentFromParam(params.get("tab")));
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogError, setDialogError] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [dragging, setDragging] = useState<AdminStaff | null>(null);

  const load = useCallback((showError: boolean) => Promise.all([listAdminStaff(), listStaffAssignableEvents()]).then(
    ([staff, list]) => { setPeople(staff); setEvents(list); setError(""); setAt(Date.now()); return true; },
    (cause: unknown) => { if (showError) setError(cause instanceof Error ? cause.message : "Không tải được dữ liệu nhân viên."); return false; },
  ).finally(() => setLoading(false)), []);

  useEffect(() => { void load(true); }, [load]);

  const counts = useMemo(() => segmentCounts(people), [people]);
  const filtered = useMemo(() => filterStaff(people, { segment, query, eventId: eventFilter }), [people, segment, query, eventFilter]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const openEvents = useMemo(() => assignableEvents(events, at), [events, at]);
  const filterEvent = eventFilter ? events.find((event) => event.id === eventFilter) ?? null : null;
  const assignTarget = assignTargetId ? openEvents.find((event) => event.id === assignTargetId) ?? null : null;
  const focused = focusId ? people.find((person) => person.id === focusId) ?? null : null;

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  }

  function selectSegment(next: StaffSegment) {
    setSegment(next); setPage(1);
    // "Tất cả" restores the complete base scope (summary-filter contract).
    if (next === "all") { setQuery(""); setParam("eventId", null); }
  }

  const handlers: StaffHandlers = {
    open: (person) => setParam("focus", String(person.id)),
    status: (person, action) => { setDialogError(""); setDialog({ kind: "status", person, action }); },
    assign: (person, event) => { setDialogError(""); setDialog({ kind: "assign", person, event }); },
  };

  async function run(person: AdminStaff, task: () => Promise<void>, done: string) {
    setPendingId(person.id); setDialogError("");
    try {
      await task();
      await load(false);
      notify.success(done, { description: person.fullName });
      setDialog(null);
    } catch (cause) {
      setDialogError(formatStaffErrorMessage(cause));
    } finally {
      setPendingId(null);
    }
  }

  function confirmDialog() {
    if (!dialog || pendingId) return;
    if (dialog.kind === "status") void run(dialog.person, () => setAdminStaffStatus(dialog.person.id, dialog.action), STATUS_COPY[dialog.action].done);
    else if (dialog.kind === "assign") void run(dialog.person, () => assignAdminStaff(dialog.person.id, dialog.event.id), `Đã phân công vào ${dialog.event.name}`);
    else void run(dialog.person, () => revokeAdminStaffAssignment(dialog.person.id, dialog.assignment.id), `Đã gỡ phân công ${dialog.assignment.eventName}`);
  }

  async function rename(person: AdminStaff, fullName: string) {
    setPendingId(person.id);
    try {
      await editAdminStaff(person.id, fullName);
      setPeople((list) => list.map((item) => (item.id === person.id ? { ...item, fullName } : item)));
      notify.success("Đã cập nhật họ tên", { description: fullName });
      return true;
    } catch (cause) {
      notify.error("Không cập nhật được họ tên", { description: formatStaffErrorMessage(cause) });
      return false;
    } finally {
      setPendingId(null);
    }
  }

  // Drag a Staff row onto an Event: proposes the assignment; the confirm dialog and the server decide.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: eventCoordinates }));
  const eventName = (id: string | number | undefined) => openEvents.find((event) => `event-${event.id}` === id)?.name ?? "ngoài danh sách sự kiện";
  const personName = (id: string | number) => people.find((person) => person.id === Number(id))?.fullName ?? "nhân viên";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Đã nhấc ${personName(active.id)}. Mũi tên lên/xuống để chọn sự kiện, Enter hoặc Space để thả, Esc để hủy.`,
    onDragOver: ({ active, over }) => `${personName(active.id)} đang ở trên ${eventName(over?.id)}.`,
    onDragEnd: ({ active, over }) => `Đã thả ${personName(active.id)} vào ${eventName(over?.id)}.`,
    onDragCancel: ({ active }) => `Đã hủy kéo ${personName(active.id)}.`,
  };
  function onDragEnd(event: DragEndEvent) {
    const person = dragging;
    setDragging(null);
    const target = event.over?.data.current?.event as AdminEvent | undefined;
    if (!person || !target) return;
    const check = canAssign(person, target, at);
    if (check.allowed) handlers.assign(person, target);
    else notify.warning("Không phân công được", { description: check.reason });
  }

  const chips: FilterChip[] = [
    ...(segment !== "all" ? [{ id: "segment", label: `Trạng thái: ${SEGMENT_LABEL[segment]}`, onRemove: () => selectSegment("all") }] : []),
    ...(eventFilter ? [{ id: "event", label: `Sự kiện: ${filterEvent?.name ?? `#${eventFilter}`}`, onRemove: () => setParam("eventId", null) }] : []),
    ...(query.trim() ? [{ id: "query", label: `Từ khóa: “${query.trim()}”`, onRemove: () => setQuery("") }] : []),
  ];

  const statusDialog = dialog?.kind === "status" ? STATUS_COPY[dialog.action] : null;

  return (
    <PageLayout className="stp">
      <PageHeader
        title="Nhân viên"
        description="Duyệt tài khoản Google, quản lý quyền và phân công trực cổng theo sự kiện."
        meta={at ? <span className="tb-num"><Clock3 size={13} aria-hidden="true" /> Cập nhật lúc {formatTime(new Date(at), true)}</span> : null}
        actions={<Button icon={RefreshCw} loading={loading && at > 0} onClick={() => { void load(false).then((ok) => { if (!ok) notify.error("Không làm mới được", { description: "Đang hiển thị dữ liệu lần tải trước." }); }); }}>Làm mới</Button>}
      />

      {error && people.length === 0 ? (
        <ErrorState title="Không tải được dữ liệu nhân viên" description={error} onRetry={() => { setLoading(true); void load(true); }} retrying={loading} />
      ) : loading && people.length === 0 ? (
        <SkeletonBlock lines={8} label="Đang tải nhân viên" />
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={({ active }) => setDragging(people.find((person) => person.id === Number(active.id)) ?? null)}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragging(null)}
          accessibility={{ announcements, screenReaderInstructions: { draggable: "Nhấn Space hoặc Enter để nhấc nhân viên, mũi tên lên/xuống để chọn sự kiện, nhấn lại để thả, Esc để hủy. Có thể dùng nút Phân công trong hồ sơ thay cho kéo thả." } }}
        >
          {assignTargetId && (assignTarget ? (
            <Notice tone="info" title={`Chọn nhân viên cho: ${assignTarget.name}`} action={<Button size="sm" onClick={() => setParam("assignEvent", null)}>Xong</Button>}>
              Check-in {formatDateTime(assignTarget.checkinStartAt)} → {formatDateTime(assignTarget.checkinEndAt)}. Bấm “Phân công” trên dòng nhân viên đang hoạt động, hoặc kéo nhân viên vào sự kiện bên phải.
            </Notice>
          ) : (
            <Notice tone="warning" title="Sự kiện trong liên kết không còn nhận phân công" action={<Button size="sm" onClick={() => setParam("assignEvent", null)}>Bỏ qua</Button>}>Sự kiện đã kết thúc, đã hủy hoặc đã qua giờ check-in.</Notice>
          ))}

          <BentoGrid>
            <BentoCard
              span={8}
              title="Tài khoản"
              subtitle={`${formatNumber(filtered.length)} / ${formatNumber(people.length)} tài khoản`}
            >
              <div className="st-chips" role="group" aria-label="Lọc theo trạng thái">
                {STAFF_SEGMENTS.map((key) => (
                  <button key={key} type="button" className={cn("st-chip", segment === key && "is-active", key === "pending" && counts.pending > 0 && "is-alert")}
                    aria-pressed={segment === key} onClick={() => selectSegment(key)}
                    aria-label={key === "all" ? `Xem tất cả ${counts.all} tài khoản` : `Lọc ${counts[key]} tài khoản ${SEGMENT_LABEL[key].toLowerCase()}`}>
                    {SEGMENT_LABEL[key]}<span className="st-chip-count tb-num">{counts[key]}</span>
                  </button>
                ))}
              </div>
              <FilterBar
                label="Tìm nhân viên"
                search={{ value: query, onChange: (value) => { setQuery(value); setPage(1); }, placeholder: "Tìm theo họ tên hoặc email" }}
                chips={chips}
                onClearAll={() => { selectSegment("all"); }}
              />
              {rows.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={query.trim() ? "Không có nhân viên khớp từ khóa" : eventFilter ? "Sự kiện chưa có nhân viên được phân công" : EMPTY[segment]}
                  description={eventFilter && !query.trim() ? "Kéo một nhân viên đang hoạt động vào sự kiện ở cột bên phải, hoặc mở hồ sơ để phân công." : undefined}
                  action={chips.length ? <Button onClick={() => selectSegment("all")}>Xem tất cả ({counts.all})</Button> : undefined}
                />
              ) : (
                <>
                  <StaffTable people={rows} handlers={handlers} pendingId={pendingId} target={assignTarget} now={at} />
                  {pages > 1 && (
                    <nav className="adm-pagination" aria-label="Phân trang nhân viên">
                      <span className="adm-pagination-range tb-num" aria-live="polite">Hiển thị {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, filtered.length)} / {filtered.length}</span>
                      <div className="adm-pagination-controls">
                        <Button size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Trước</Button>
                        <span className="adm-pagination-page tb-num">Trang {current}/{pages}</span>
                        <Button size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>Sau</Button>
                      </div>
                    </nav>
                  )}
                </>
              )}
            </BentoCard>

            <BentoCard span={4} title="Sự kiện cần trực cổng" subtitle={dragging ? `Thả ${dragging.fullName} vào một sự kiện` : "Kéo nhân viên vào sự kiện để phân công · bấm để lọc"}>
              <EventColumn events={openEvents} people={people} dragging={dragging} selectedId={eventFilter ?? assignTarget?.id ?? null} now={at}
                onSelect={(event) => { setParam("eventId", eventFilter === event.id ? null : String(event.id)); setPage(1); }} />
            </BentoCard>
          </BentoGrid>

          <DragOverlay dropAnimation={null}>
            {dragging ? <div className="st-drag"><GripVertical size={16} aria-hidden="true" /><Avatar name={dragging.fullName} size="sm" /><strong>{dragging.fullName}</strong></div> : null}
          </DragOverlay>
        </DndContext>
      )}

      <StaffPanel
        person={focused}
        events={events}
        now={at}
        pending={Boolean(focused && pendingId === focused.id && !dialog)}
        onClose={() => setParam("focus", null)}
        onRename={rename}
        onAssign={handlers.assign}
        onRevoke={(person, assignment) => { setDialogError(""); setDialog({ kind: "revoke", person, assignment }); }}
      />

      <ConfirmDialog
        open={dialog?.kind === "status"}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        tone={statusDialog?.tone ?? "primary"}
        title={statusDialog?.title ?? ""}
        description={dialog?.kind === "status" ? `${dialog.person.fullName} · ${dialog.person.email}` : undefined}
        consequences={statusDialog?.points}
        confirmLabel={statusDialog?.confirm ?? ACTION_LABEL.approve}
        pending={Boolean(dialog && pendingId === dialog.person.id)}
        error={dialogError}
        onConfirm={confirmDialog}
      />
      <ConfirmDialog
        open={dialog?.kind === "assign"}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        tone="primary"
        title="Phân công trực cổng?"
        description={dialog?.kind === "assign" ? <><strong>{dialog.person.fullName}</strong> → {dialog.event.name}</> : undefined}
        consequences={dialog?.kind === "assign" ? [
          `Ca check-in: ${formatDateTime(dialog.event.checkinStartAt)} → ${formatDateTime(dialog.event.checkinEndAt)}.`,
          `Sự kiện: ${statusStyle("event", dialog.event.status).label}. Nhân viên quét vé được trong ca này.`,
          "Máy chủ kiểm tra lại trùng ca (kể cả chạm biên) khi lưu.",
        ] : undefined}
        confirmLabel="Phân công"
        pending={Boolean(dialog && pendingId === dialog.person.id)}
        error={dialogError}
        onConfirm={confirmDialog}
      />
      <ConfirmDialog
        open={dialog?.kind === "revoke"}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        title="Gỡ phân công?"
        description={dialog?.kind === "revoke" ? <><strong>{dialog.person.fullName}</strong> khỏi {dialog.assignment.eventName}</> : undefined}
        consequences={["Nhân viên mất quyền check-in tại sự kiện này ngay.", "Phân công chuyển vào lịch sử; có thể phân công lại sau."]}
        confirmLabel="Gỡ phân công"
        pending={Boolean(dialog && pendingId === dialog.person.id)}
        error={dialogError}
        onConfirm={confirmDialog}
      />
    </PageLayout>
  );
}
