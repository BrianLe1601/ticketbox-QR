import { Command } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useState } from "react";

import { Popover } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/admin-format";
import { statusStyle } from "@/lib/admin-status";
import { cn } from "@/lib/utils";
import type { AdminEvent, EventStatus } from "@/services/admin-events.service";

// Grouped by status (the heading names it), so items carry no badge. Events that still sell come first: that is where Ticket Types are edited most.
const GROUP_ORDER: EventStatus[] = ["ongoing", "published", "draft", "completed", "cancelled"];

/**
 * Searchable Event dropdown (combobox). Replaces the always-open Event column so the tier table
 * gets the width. cmdk gives type-to-filter, arrow keys and Enter; Escape closes and focus
 * returns to the trigger (Radix Popover).
 */
export function EventSelect({ events, selected, onSelect }: { events: AdminEvent[]; selected: AdminEvent; onSelect: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const groups = GROUP_ORDER
    .map((status) => ({ status, items: events.filter((event) => event.status === status).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime)) }))
    .filter((group) => group.items.length > 0);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label="Chọn sự kiện"
      className="tt-select-pop"
      trigger={
        <button type="button" className="tt-select-trigger" aria-label={`Sự kiện đang chọn: ${selected.name}. Bấm để đổi sự kiện`}>
          <span className="tt-select-text">
            <span className="tt-select-label">Sự kiện</span>
            <span className="tt-select-name">{selected.name}</span>
          </span>
          <ChevronsUpDown size={16} aria-hidden="true" />
        </button>
      }
    >
      <Command label="Chọn sự kiện" className="tt-select" loop>
        <div className="tt-select-search">
          <Search size={15} aria-hidden="true" />
          <Command.Input autoFocus placeholder={`Tìm trong ${events.length} sự kiện…`} />
        </div>
        <Command.List className="tt-select-list">
          <Command.Empty className="tt-select-empty">Không có sự kiện khớp từ khóa.</Command.Empty>
          {groups.map((group) => (
            <Command.Group key={group.status} heading={`${statusStyle("event", group.status).label} (${group.items.length})`}>
              {group.items.map((event) => (
                <Command.Item
                  key={event.id}
                  value={`${event.name} ${event.id}`}
                  keywords={[event.venue, event.city, event.category]}
                  onSelect={() => { onSelect(event.id); setOpen(false); }}
                  className={cn("tt-select-item", event.id === selected.id && "is-current")}
                >
                  <span className="tt-select-check" aria-hidden="true">{event.id === selected.id && <Check size={15} />}</span>
                  <span className="tt-select-item-text">
                    <span className="tt-select-item-name">{event.name}</span>
                    <span className="tt-select-item-meta tb-num">{formatDateTime(event.startTime)} · {event.validTicketTypeCount}/{event.ticketTypeCount} hạng hợp lệ</span>
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </Popover>
  );
}
