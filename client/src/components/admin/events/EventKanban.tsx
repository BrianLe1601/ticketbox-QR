import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type Announcements, type DragEndEvent, type DragStartEvent, type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { CalendarClock, GripVertical, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { ActionMenu } from "@/components/admin/ui";
import { formatDateTime, formatNumber } from "@/lib/admin-format";
import { EVENT_STATUSES, kanbanDrop } from "@/lib/admin-events-view";
import { statusStyle } from "@/lib/admin-status";
import { cn } from "@/lib/utils";
import type { AdminEvent, EventStatus } from "@/services/admin-events.service";
import { eventMenuActions, type EventHandlers } from "./eventActions";

const HINT: Record<EventStatus, string> = {
  draft: "Kéo sang Đã công bố để công bố",
  published: "Kéo sang Đã hủy để hủy",
  ongoing: "Máy chủ tự chuyển theo giờ",
  completed: "Trạng thái kết thúc",
  cancelled: "Trạng thái kết thúc",
};

const label = (status: EventStatus) => statusStyle("event", status).label;

/** Keyboard dragging moves one column per ←/→ (the default sensor moves 25px per press). */
const columnCoordinates: KeyboardCoordinateGetter = (event, { context: { collisionRect, droppableRects } }) => {
  if (!collisionRect || (event.code !== "ArrowRight" && event.code !== "ArrowLeft")) return undefined;
  event.preventDefault();
  const columns = EVENT_STATUSES.map((status) => droppableRects.get(status)).filter((rect): rect is NonNullable<typeof rect> => Boolean(rect));
  const center = collisionRect.left + collisionRect.width / 2;
  const current = columns.findIndex((rect) => center >= rect.left && center <= rect.left + rect.width);
  const next = columns[Math.min(columns.length - 1, Math.max(0, (current < 0 ? 0 : current) + (event.code === "ArrowRight" ? 1 : -1)))];
  return next ? { x: next.left + (next.width - collisionRect.width) / 2, y: next.top + 48 } : undefined;
};

function CardBody({ event }: { event: AdminEvent }) {
  return (
    <>
      <span className="ev-kcard-name">{event.name}</span>
      <span className="ev-kcard-meta"><CalendarClock size={13} aria-hidden="true" /><span className="tb-num">{formatDateTime(event.startTime)}</span></span>
      <span className="ev-kcard-meta">
        <Users size={13} aria-hidden="true" />{event.activeStaffCount ? `${event.activeStaffCount} nhân viên` : <span className="ev-warn">Chưa có nhân viên</span>}
      </span>
      <span className="ev-kcard-sold tb-num">Đã bán {formatNumber(event.soldQuantity)}/{formatNumber(event.allocatedCapacity)} vé</span>
      {event.visibility === "hidden" && <span className="ev-kcard-flag">Đang ẩn</span>}
      {event.status === "draft" && !event.readiness.ready && <span className="ev-kcard-flag is-missing">Chưa đủ điều kiện công bố</span>}
    </>
  );
}

function KanbanCard({ event, handlers, draggable }: { event: AdminEvent; handlers: EventHandlers; draggable: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: event.id, disabled: !draggable, data: { event } });
  return (
    <li ref={setNodeRef} className={cn("ev-kcard", isDragging && "is-dragging")}>
      {draggable ? (
        <button type="button" className="ev-kcard-grip" aria-label={`Kéo ${event.name}`} {...attributes} {...listeners}>
          <GripVertical size={16} aria-hidden="true" />
        </button>
      ) : <span className="ev-kcard-grip is-locked" aria-hidden="true" />}
      <button type="button" className="ev-kcard-main" onClick={() => handlers.open(event)} aria-label={`Xem chi tiết ${event.name}`}>
        <CardBody event={event} />
      </button>
      <span className="ev-kcard-menu"><ActionMenu label={`Thao tác khác cho ${event.name}`} actions={eventMenuActions(event, handlers)} /></span>
    </li>
  );
}

function Column({ status, events, handlers, active }: { status: EventStatus; events: AdminEvent[]; handlers: EventHandlers; active: AdminEvent | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const drop = active ? kanbanDrop(active, status) : null;
  const tone = statusStyle("event", status).tone;
  return (
    <section
      ref={setNodeRef}
      className={cn("ev-kcol", `is-${tone}`, drop?.action === "publish" || drop?.action === "cancel" ? "is-accept" : drop?.action === "reject" ? "is-reject" : null, isOver && "is-over")}
      aria-label={`${label(status)}, ${events.length} sự kiện`}
    >
      <header className="ev-kcol-head">
        <span className="ev-kcol-title"><span className="ev-kcol-dot" aria-hidden="true" />{label(status)}</span>
        <span className="ev-kcol-count tb-num">{events.length}</span>
      </header>
      <p className="ev-kcol-hint">{HINT[status]}</p>
      {events.length === 0 ? <p className="ev-kcol-empty">Không có sự kiện {label(status).toLowerCase()}</p> : (
        <ul className="ev-kcol-list">
          {events.map((event) => <KanbanCard key={event.id} event={event} handlers={handlers} draggable={event.status === "draft" || event.status === "published" || event.status === "ongoing"} />)}
        </ul>
      )}
    </section>
  );
}

/**
 * Board by lifecycle status. Dropping only *proposes* publish or cancel: the page opens the
 * same confirmation as the menu, and the server decides. Cards never move optimistically.
 */
export function EventKanban({ events, handlers, onReject }: { events: AdminEvent[]; handlers: EventHandlers; onReject: (reason: string) => void }) {
  const [active, setActive] = useState<AdminEvent | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: columnCoordinates }));
  const columns = useMemo(() => EVENT_STATUSES.map((status) => ({ status, events: events.filter((event) => event.status === status) })), [events]);
  const byId = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);

  const nameOf = (id: string | number) => byId.get(Number(id))?.name ?? "sự kiện";
  const columnOf = (id: string | number | undefined) => (id ? label(id as EventStatus) : "ngoài bảng");
  const announcements: Announcements = {
    onDragStart: ({ active: item }) => `Đã nhấc ${nameOf(item.id)}. Mũi tên trái/phải để chọn cột, Enter hoặc Space để thả, Esc để hủy.`,
    onDragOver: ({ active: item, over }) => `${nameOf(item.id)} đang ở trên cột ${columnOf(over?.id)}.`,
    onDragEnd: ({ active: item, over }) => `Đã thả ${nameOf(item.id)} vào cột ${columnOf(over?.id)}.`,
    onDragCancel: ({ active: item }) => `Đã hủy kéo ${nameOf(item.id)}.`,
  };

  function onDragStart(event: DragStartEvent) {
    setActive(byId.get(Number(event.active.id)) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    const dragged = byId.get(Number(event.active.id));
    setActive(null);
    if (!dragged || !event.over) return;
    const result = kanbanDrop(dragged, event.over.id as EventStatus);
    if (result.action === "publish") handlers.publish(dragged);
    else if (result.action === "cancel") handlers.cancel(dragged);
    else if (result.action === "reject") onReject(result.reason);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{ announcements, screenReaderInstructions: { draggable: "Nhấn Space hoặc Enter để nhấc thẻ, mũi tên trái/phải để chọn cột, nhấn lại để thả, Esc để hủy." } }}
    >
      <div className="ev-kanban">
        {columns.map((column) => <Column key={column.status} status={column.status} events={column.events} handlers={handlers} active={active} />)}
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? <div className="ev-kcard is-overlay"><span className="ev-kcard-grip" aria-hidden="true"><GripVertical size={16} /></span><span className="ev-kcard-main"><CardBody event={active} /></span></div> : null}
      </DragOverlay>
    </DndContext>
  );
}
