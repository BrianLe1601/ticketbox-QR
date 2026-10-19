import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";

import { Button, EmptyState, IconButton } from "@/components/admin/ui";
import { formatTime } from "@/lib/admin-format";
import { eventsByDay, monthGrid, monthLabel, shiftMonth, vnDateKey, type MonthCursor } from "@/lib/admin-events-view";
import { statusStyle } from "@/lib/admin-status";
import { cn } from "@/lib/utils";
import type { AdminEvent } from "@/services/admin-events.service";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function EventChip({ event, onOpen }: { event: AdminEvent; onOpen: (event: AdminEvent) => void }) {
  const status = statusStyle("event", event.status);
  return (
    <button
      type="button"
      className={cn("ev-chip", `is-${status.tone}`, event.visibility === "hidden" && "is-hidden")}
      onClick={() => onOpen(event)}
      aria-label={`${event.name}, ${formatTime(event.startTime)}, ${status.label}${event.visibility === "hidden" ? ", đang ẩn" : ""}`}
    >
      <span className="ev-chip-time tb-num">{formatTime(event.startTime)}</span>
      <span className="ev-chip-name">{event.name}</span>
    </button>
  );
}

/** Month view by Vietnam start day. Narrow screens get an agenda of the same month instead. */
export function EventCalendar({ events, cursor, onCursorChange, onOpen }: {
  events: AdminEvent[]; cursor: MonthCursor; onCursorChange: (next: MonthCursor) => void; onOpen: (event: AdminEvent) => void;
}) {
  const weeks = useMemo(() => monthGrid(cursor), [cursor]);
  const byDay = useMemo(() => eventsByDay(events), [events]);
  const today = vnDateKey(new Date());
  const monthPrefix = `${cursor.year}-${String(cursor.month).padStart(2, "0")}`;
  const agenda = [...byDay.entries()].filter(([key]) => key.startsWith(monthPrefix));
  const monthCount = agenda.reduce((sum, [, list]) => sum + list.length, 0);

  return (
    <div className="ev-cal">
      <div className="ev-cal-bar">
        <div className="ev-cal-nav">
          <IconButton icon={ChevronLeft} label="Tháng trước" size="sm" variant="secondary" onClick={() => onCursorChange(shiftMonth(cursor, -1))} />
          <h3 className="ev-cal-title" aria-live="polite">{monthLabel(cursor)}</h3>
          <IconButton icon={ChevronRight} label="Tháng sau" size="sm" variant="secondary" onClick={() => onCursorChange(shiftMonth(cursor, 1))} />
        </div>
        <span className="ev-cal-count tb-num">{monthCount} sự kiện trong tháng</span>
        <Button size="sm" variant="ghost" onClick={() => { const [y, m] = today.split("-").map(Number); onCursorChange({ year: y, month: m }); }}>Tháng này</Button>
      </div>

      <div className="ev-cal-grid" role="table" aria-label={`Lịch sự kiện ${monthLabel(cursor)}`}>
        <div className="ev-cal-row ev-cal-head" role="row">
          {WEEKDAYS.map((day) => <span key={day} role="columnheader" className="ev-cal-wd">{day}</span>)}
        </div>
        {weeks.map((week) => (
          <div className="ev-cal-row" role="row" key={week[0].key}>
            {week.map((day) => {
              const list = byDay.get(day.key) ?? [];
              return (
                <div key={day.key} role="cell" className={cn("ev-cal-day", !day.inMonth && "is-out", day.key === today && "is-today", day.weekday >= 5 && "is-weekend")}
                  aria-label={`Ngày ${day.day}${list.length ? `, ${list.length} sự kiện` : ""}`}>
                  <span className="ev-cal-num tb-num" aria-hidden="true">{day.day}</span>
                  {/* One venue, no overlaps: a day holds only a few concerts, so all are shown. */}
                  {list.map((event) => <EventChip key={event.id} event={event} onOpen={onOpen} />)}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="ev-agenda">
        {agenda.length === 0 ? <EmptyState compact icon={CalendarDays} title={`Không có sự kiện trong ${monthLabel(cursor).toLowerCase()}`} /> : (
          <ol>
            {agenda.map(([key, list]) => {
              const [, m, d] = key.split("-");
              return (
                <li key={key} className={cn(key === today && "is-today")}>
                  <span className="ev-agenda-date tb-num"><strong>{d}</strong><small>TH{Number(m)}</small></span>
                  <div className="ev-agenda-list">{list.map((event) => <EventChip key={event.id} event={event} onOpen={onOpen} />)}</div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
