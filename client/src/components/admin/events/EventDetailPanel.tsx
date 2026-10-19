import { Edit3, Ticket, Users } from "lucide-react";
import { useState, type ReactNode } from "react";

import { ActionMenu, Button, ButtonLink, Notice, SlideOver } from "@/components/admin/ui";
import { formatDateTime, formatNumber } from "@/lib/admin-format";
import { canEdit, soldShare } from "@/lib/admin-events-view";
import { readinessText } from "@/lib/admin-readiness";
import type { AdminEvent } from "@/services/admin-events.service";
import { EventCover, EventFlags } from "./EventCard";
import { eventMenuActions, staffPath, ticketTypesPath, type EventHandlers } from "./eventActions";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="ev-dl-row"><dt>{label}</dt><dd>{children}</dd></div>;
}

/** Read-only summary of one Event with its lifecycle-safe actions. */
export function EventDetailPanel({ event, open, onOpenChange, handlers }: {
  event: AdminEvent | null; open: boolean; onOpenChange: (open: boolean) => void; handlers: EventHandlers;
}) {
  // Keep the last Event while closing, so the dialog closes (and returns focus) instead of
  // being unmounted the moment the URL loses ?focus.
  const [kept, setKept] = useState<AdminEvent | null>(event);
  if (event && event !== kept) setKept(event);
  const shown = event ?? kept;
  if (!shown) return null;
  return <PanelBody event={shown} open={open && Boolean(event)} onOpenChange={onOpenChange} handlers={handlers} />;
}

function PanelBody({ event, open, onOpenChange, handlers }: { event: AdminEvent; open: boolean; onOpenChange: (open: boolean) => void; handlers: EventHandlers }) {
  const edit = canEdit(event);
  const share = soldShare(event);
  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={event.name}
      headerExtra={<div className="ev-detail-flags"><EventFlags event={event} /></div>}
      footer={<>
        <ActionMenu size="md" label={`Thao tác khác cho ${event.name}`} actions={eventMenuActions(event, handlers, { includeEdit: false })} />
        <span className="ev-foot-spacer" />
        <ButtonLink to={ticketTypesPath(event)} icon={Ticket}>Hạng vé</ButtonLink>
        <Button variant="primary" icon={Edit3} disabled={!edit.allowed} disabledReason={edit.reason} onClick={() => handlers.edit(event)}>Chỉnh sửa</Button>
      </>}
    >
      <div className="ev-detail">
        <div className="ev-detail-cover"><EventCover event={event} /></div>

        {event.visibility === "hidden" && (
          <Notice tone="warning" title="Sự kiện đang ẩn khỏi trang khách">{event.hiddenReason ? `Lý do: ${event.hiddenReason}` : "Không có lý do được ghi lại."}</Notice>
        )}
        {event.status === "draft" && !event.readiness.ready && (
          <Notice tone="warning" title="Chưa đủ điều kiện công bố">
            <ul className="ev-missing">{(event.readiness.missing.length ? event.readiness.missing : ["VALID_TICKET_TYPE_REQUIRED"]).map((code) => <li key={code}>{readinessText(code)}</li>)}</ul>
          </Notice>
        )}

        <section className="ev-detail-sec" aria-labelledby="ev-sec-time">
          <h3 id="ev-sec-time">Lịch</h3>
          <dl className="ev-dl">
            <Row label="Bắt đầu"><span className="tb-num">{formatDateTime(event.startTime)}</span></Row>
            <Row label="Kết thúc"><span className="tb-num">{formatDateTime(event.endTime)}</span></Row>
            <Row label="Bán vé"><span className="tb-num">{formatDateTime(event.salesStartAt)} → {formatDateTime(event.salesEndAt)}</span></Row>
            <Row label="Check-in"><span className="tb-num">{formatDateTime(event.checkinStartAt)} → {formatDateTime(event.checkinEndAt)}</span></Row>
            {event.scheduledPublishAt && <Row label="Tự công bố"><span className="tb-num">{formatDateTime(event.scheduledPublishAt)}</span></Row>}
          </dl>
        </section>

        <section className="ev-detail-sec" aria-labelledby="ev-sec-venue">
          <h3 id="ev-sec-venue">Địa điểm</h3>
          <dl className="ev-dl">
            <Row label="Địa điểm">{event.venue}</Row>
            <Row label="Địa chỉ">{event.address}, {event.city}</Row>
            <Row label="Sức chứa"><span className="tb-num">{formatNumber(event.venueCapacity)} chỗ</span></Row>
          </dl>
        </section>

        <section className="ev-detail-sec" aria-labelledby="ev-sec-sales">
          <h3 id="ev-sec-sales">Vé và đơn hàng</h3>
          <div className="ev-sold">
            <span className="ev-sold-text"><span>Đã bán</span><strong className="tb-num">{formatNumber(event.soldQuantity)} / {formatNumber(event.allocatedCapacity)} vé · {Math.round(share * 100)}%</strong></span>
            <span className="ev-bar" role="img" aria-label={`Đã bán ${Math.round(share * 100)}%`}><span style={{ width: `${share * 100}%` }} /></span>
          </div>
          <dl className="ev-dl">
            <Row label="Hạng vé hợp lệ"><span className="tb-num">{event.validTicketTypeCount}/{event.ticketTypeCount}</span></Row>
            <Row label="Đơn chờ thanh toán"><span className="tb-num">{formatNumber(event.pendingOrderCount)}</span></Row>
            <Row label="Đơn đã xác nhận"><span className="tb-num">{formatNumber(event.confirmedOrderCount)}</span></Row>
          </dl>
        </section>

        <section className="ev-detail-sec" aria-labelledby="ev-sec-staff">
          <h3 id="ev-sec-staff">Nhân sự check-in</h3>
          <p className="ev-detail-staff">
            {event.activeStaffCount ? <><strong className="tb-num">{event.activeStaffCount}</strong> nhân viên đang được phân công</> : <span className="ev-warn">Chưa có nhân viên được phân công</span>}
          </p>
          <ButtonLink to={staffPath(event)} size="sm" icon={Users}>Mở trang Nhân viên</ButtonLink>
        </section>

        {event.description && (
          <section className="ev-detail-sec" aria-labelledby="ev-sec-desc">
            <h3 id="ev-sec-desc">Mô tả</h3>
            <p className="ev-detail-desc">{event.description}</p>
          </section>
        )}
      </div>
    </SlideOver>
  );
}
