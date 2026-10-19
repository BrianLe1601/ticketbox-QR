import { CalendarClock, EyeOff, Send, Ticket, Users } from "lucide-react";

import { ActionMenu, Button, ButtonLink, StatusBadge } from "@/components/admin/ui";
import { formatDateTime, formatNumber } from "@/lib/admin-format";
import { canPublish, soldShare } from "@/lib/admin-events-view";
import { cn } from "@/lib/utils";
import type { AdminEvent } from "@/services/admin-events.service";
import { eventMenuActions, ticketTypesPath, type EventHandlers } from "./eventActions";

export function EventCover({ event, className }: { event: AdminEvent; className?: string }) {
  return event.coverImageUrl
    ? <img className={cn("ev-cover", className)} src={event.coverImageUrl} alt={event.coverImageAlt || `Ảnh bìa ${event.name}`} loading="lazy" />
    : <span className={cn("ev-cover ev-cover--empty", className)} aria-hidden="true"><Ticket size={28} /><span>{event.category}</span></span>;
}

export function EventFlags({ event }: { event: AdminEvent }) {
  return (
    <span className="ev-flags">
      <StatusBadge domain="event" status={event.status} size="sm" />
      {event.visibility === "hidden" && <StatusBadge label="Đang ẩn" tone="warning" size="sm" />}
      {event.status === "draft" && event.scheduledPublishAt && <StatusBadge label={`Tự công bố ${formatDateTime(event.scheduledPublishAt)}`} tone="primary" size="sm" />}
    </span>
  );
}

export function EventCard({ event, handlers }: { event: AdminEvent; handlers: EventHandlers }) {
  const publish = canPublish(event);
  const share = soldShare(event);
  return (
    <article className={cn("ev-card", event.visibility === "hidden" && "is-hidden")} aria-labelledby={`ev-card-${event.id}`}>
      <div className="ev-card-media">
        <EventCover event={event} />
      </div>
      <div className="ev-card-body">
        <EventFlags event={event} />
        <h3 className="ev-card-title" id={`ev-card-${event.id}`}>
          <button type="button" className="ev-link" onClick={() => handlers.open(event)}>{event.name}</button>
        </h3>
        <ul className="ev-card-meta">
          <li><CalendarClock size={14} aria-hidden="true" /><span className="tb-num">{formatDateTime(event.startTime)}</span></li>
          <li><Users size={14} aria-hidden="true" />{event.activeStaffCount ? `${event.activeStaffCount} nhân viên trực` : <span className="ev-warn">Chưa có nhân viên</span>}</li>
          {event.visibility === "hidden" && <li><EyeOff size={14} aria-hidden="true" />Khách không thấy sự kiện này</li>}
        </ul>
        {event.status === "draft" ? (
          <p className={cn("ev-ready", event.readiness.ready ? "is-ready" : "is-missing")}>
            <strong className="tb-num">{event.validTicketTypeCount}/{event.ticketTypeCount}</strong> hạng vé hợp lệ · {event.readiness.ready ? "Sẵn sàng công bố" : "Cần hoàn thiện"}
          </p>
        ) : (
          <div className="ev-sold">
            <span className="ev-sold-text"><span>Đã bán</span><strong className="tb-num">{formatNumber(event.soldQuantity)} / {formatNumber(event.allocatedCapacity)} vé</strong></span>
            <span className="ev-bar" role="img" aria-label={`Đã bán ${Math.round(share * 100)}%`}><span style={{ width: `${share * 100}%` }} /></span>
          </div>
        )}
      </div>
      <footer className="ev-card-foot">
        {event.status === "draft"
          ? <Button size="sm" variant="primary" icon={Send} disabled={!publish.allowed} disabledReason={publish.reason} onClick={() => handlers.publish(event)}>Công bố</Button>
          : <ButtonLink size="sm" to={ticketTypesPath(event)} icon={Ticket}>Hạng vé</ButtonLink>}
        <Button size="sm" variant="ghost" onClick={() => handlers.open(event)}>Chi tiết</Button>
        <ActionMenu label={`Thao tác khác cho ${event.name}`} actions={eventMenuActions(event, handlers)} />
      </footer>
    </article>
  );
}
