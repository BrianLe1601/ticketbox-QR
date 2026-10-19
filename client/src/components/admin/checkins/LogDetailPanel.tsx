import { CalendarDays, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { SlideOver, StatusBadge } from "@/components/admin/ui";
import { resultLabel, TICKET_STATE_LABEL } from "@/lib/admin-checkin-logs";
import { formatDate, formatTime } from "@/lib/admin-format";
import type { AdminCheckinLog } from "@/services/report.service";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="ck-dl-row"><dt>{label}</dt><dd>{children ?? "—"}</dd></div>;
}

/** Read-only detail of one scan. Logs are append-only audit history: nothing here mutates. */
export function LogDetailPanel({ log, onClose }: { log: AdminCheckinLog | null; onClose: () => void }) {
  const known = Boolean(log?.ticketCode);
  return (
    <SlideOver
      open={Boolean(log)}
      onOpenChange={(open) => { if (!open) onClose(); }}
      size="md"
      title={log ? resultLabel(log.result) : ""}
      description={log ? <span className="tb-num">{formatDate(log.checkedAt)} lúc {formatTime(log.checkedAt, true)} · nhật ký #{log.id}</span> : undefined}
    >
      {log && (
        <div className="ck-detail">
          <section className={`ck-verdict is-${log.result === "SUCCESS" ? "ok" : log.result === "ALREADY_CHECKED_IN" || log.result === "EVENT_NOT_AVAILABLE" ? "warn" : "bad"}`}>
            <StatusBadge domain="scan" status={log.result} label={resultLabel(log.result)} />
            <p>{log.message ?? resultLabel(log.result)}</p>
          </section>

          <section aria-labelledby="ck-d-ticket">
            <h3 id="ck-d-ticket">Vé được quét</h3>
            {known ? (
              <dl className="ck-dl">
                <Row label="Mã vé"><span className="tb-num ck-mono">{log.ticketCode}</span></Row>
                <Row label="Hạng vé">{log.ticketTypeName}</Row>
                <Row label="Trạng thái hiện tại">{log.ticketStatus ? TICKET_STATE_LABEL[log.ticketStatus] ?? log.ticketStatus : null}</Row>
                <Row label="Người giữ vé">{log.holderName}</Row>
                <Row label="Email người giữ vé">{log.holderEmail}</Row>
              </dl>
            ) : (
              <p className="ck-muted">Mã quét không khớp vé nào. Hệ thống chỉ lưu dấu nhận diện đã che <span className="tb-num ck-mono">{log.scannedCode ?? "—"}</span>, không lưu mã QR gốc.</p>
            )}
          </section>

          {known && (
            <section aria-labelledby="ck-d-order">
              <h3 id="ck-d-order">Đơn hàng</h3>
              <dl className="ck-dl">
                <Row label="Mã đơn"><span className="tb-num ck-mono">{log.orderCode}</span></Row>
                <Row label="Người mua">{log.buyerName}</Row>
                <Row label="Email người mua">{log.buyerEmail}</Row>
                <Row label="Số điện thoại"><span className="tb-num">{log.buyerPhone}</span></Row>
              </dl>
            </section>
          )}

          <section aria-labelledby="ck-d-gate">
            <h3 id="ck-d-gate">Tại cổng</h3>
            <dl className="ck-dl">
              <Row label="Sự kiện"><Link className="ck-link" to={`/admin/events?focus=${log.eventId}`}><CalendarDays size={14} aria-hidden="true" /> {log.eventName}</Link></Row>
              <Row label="Nhân viên quét"><Link className="ck-link" to={`/admin/staff?focus=${log.staffId}`}><UserRound size={14} aria-hidden="true" /> {log.staffName}</Link></Row>
              <Row label="Mã đã che"><span className="tb-num ck-mono">{log.scannedCode}</span></Row>
            </dl>
          </section>
          <p className="ck-note">Nhật ký chỉ đọc, không sửa hay xóa được. "Trạng thái hiện tại" là trạng thái vé bây giờ, không phải lúc quét.</p>
        </div>
      )}
    </SlideOver>
  );
}
