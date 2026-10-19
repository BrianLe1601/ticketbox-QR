import { useDroppable } from "@dnd-kit/core";
import { CalendarClock, Users } from "lucide-react";

import { EmptyState, StatusBadge } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/admin-format";
import { canAssign, staffOnEvent } from "@/lib/admin-staff";
import { cn } from "@/lib/utils";
import type { AdminEvent } from "@/services/admin-events.service";
import type { AdminStaff } from "@/services/admin-staff.service";

function EventDrop({ event, people, dragging, selected, now, onSelect }: {
  event: AdminEvent; people: AdminStaff[]; dragging: AdminStaff | null; selected: boolean; now: number; onSelect: (event: AdminEvent) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `event-${event.id}`, data: { event } });
  const assigned = staffOnEvent(people, event.id);
  const check = dragging ? canAssign(dragging, event, now) : null;
  return (
    <li ref={setNodeRef} className={cn("st-event", selected && "is-selected", check && (check.allowed ? "is-accept" : "is-reject"), isOver && "is-over")}>
      <button type="button" className="st-event-main" aria-pressed={selected} onClick={() => onSelect(event)}
        aria-label={`${event.name}: ${assigned.length} nhân viên. ${selected ? "Bỏ lọc" : "Lọc danh sách theo sự kiện này"}`}>
        <span className="st-event-name">{event.name}</span>
        <span className="st-event-meta tb-num"><CalendarClock size={13} aria-hidden="true" />Check-in {formatDateTime(event.checkinStartAt)}</span>
        <span className="st-event-foot">
          <StatusBadge domain="event" status={event.status} size="sm" />
          <span className={cn("st-event-count", assigned.length === 0 && "is-empty")}><Users size={13} aria-hidden="true" />{assigned.length ? `${assigned.length} nhân viên` : "Chưa có nhân viên"}</span>
        </span>
        {check && !check.allowed && <span className="st-event-why">{check.reason}</span>}
      </button>
    </li>
  );
}

/**
 * Events that can still receive Staff (open lifecycle, check-in not over), soonest first. Each is
 * a drop target for a dragged Staff row and a filter button for the table.
 */
export function EventColumn({ events, people, dragging, selectedId, now, onSelect }: {
  events: AdminEvent[]; people: AdminStaff[]; dragging: AdminStaff | null; selectedId: number | null; now: number; onSelect: (event: AdminEvent) => void;
}) {
  if (events.length === 0) return <EmptyState compact icon={CalendarClock} title="Không có sự kiện nào còn nhận phân công" />;
  return (
    <ul className="st-events" aria-label="Sự kiện còn nhận phân công">
      {events.map((event) => <EventDrop key={event.id} event={event} people={people} dragging={dragging} selected={selectedId === event.id} now={now} onSelect={onSelect} />)}
    </ul>
  );
}
