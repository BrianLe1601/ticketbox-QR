import { Ban, Check, CheckCheck, Clock3, RefreshCcw, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button, ConfirmDialog, ErrorState, Field, Notice, SkeletonBlock, SlideOver, StatusBadge, TabPanel, Tabs, Textarea } from "@/components/admin/ui";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/admin-format";
import { EMAIL_TYPE_LABEL, canRetryEmail, refundSteps } from "@/lib/admin-orders";
import { statusStyle } from "@/lib/admin-status";
import { cn } from "@/lib/utils";
import {
  cancelAdminOrder, getAdminOrder, retryAdminOrderEmail, updateAdminOrderRefund, type AdminOrderDetail,
} from "@/services/admin-orders.service";

export type OrderTab = "overview" | "tickets" | "payments" | "emails" | "refund";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="od-row"><dt>{label}</dt><dd>{children}</dd></div>;
}

const message = (caught: unknown, fallback: string) => (caught instanceof Error && caught.message ? caught.message : fallback);

/**
 * One Order: summary + tabs (Tổng quan / Vé / Thanh toán / Email / Hoàn tiền). Actions call the same
 * service functions as before; the server decides (Tài's module, UI-only rebuild).
 */
export function OrderDetailPanel({ orderId, initialTab, now, onClose, onChanged }: {
  orderId: number | null; initialTab: OrderTab; now: number; onClose: () => void; onChanged: (updated: AdminOrderDetail | null) => void;
}) {
  const [kept, setKept] = useState<number | null>(orderId);
  if (orderId && orderId !== kept) setKept(orderId);
  const shownId = orderId ?? kept;
  if (!shownId) return null;
  return <Body key={`${shownId}-${initialTab}`} orderId={shownId} open={Boolean(orderId)} initialTab={initialTab} now={now} onClose={onClose} onChanged={onChanged} />;
}

function Body({ orderId, open, initialTab, now, onClose, onChanged }: {
  orderId: number; open: boolean; initialTab: OrderTab; now: number; onClose: () => void; onChanged: (updated: AdminOrderDetail | null) => void;
}) {
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<OrderTab>(initialTab);
  const [busy, setBusy] = useState<"cancel" | "retry" | "refresh" | "refund" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [failureReason, setFailureReason] = useState("");

  useEffect(() => {
    let active = true;
    getAdminOrder(orderId).then(
      (data) => { if (active) { setDetail(data); setLoadError(""); } },
      (caught: unknown) => { if (active) setLoadError(message(caught, "Không thể tải chi tiết đơn hàng.")); },
    );
    return () => { active = false; };
  }, [orderId, reload]);

  async function act(kind: NonNullable<typeof busy>, task: () => Promise<string | null>) {
    if (busy) return;
    setBusy(kind); setError(""); setNotice("");
    try {
      const text = await task();
      if (text) setNotice(text);
    } catch (caught) {
      setError(message(caught, "Thao tác không thành công."));
    } finally {
      setBusy(null);
    }
  }

  const refund = detail?.refund ?? null;
  const refundApplies = Boolean(detail && detail.eventStatus === "cancelled" && refund && refund.status !== "not_required");

  const cancelOrder = () => act("cancel", async () => {
    const updated = await cancelAdminOrder(orderId);
    setDetail(updated); onChanged(updated); setConfirmCancel(false);
    return "Đã hủy đơn hàng thành công.";
  });
  const retry = (logId: number) => act("retry", async () => {
    const result = await retryAdminOrderEmail(orderId, logId);
    setDetail(await getAdminOrder(orderId));
    return result.message;
  });
  const refreshEmails = () => act("refresh", async () => { setDetail(await getAdminOrder(orderId)); return null; });
  const transition = (next: "processing" | "completed" | "failed") => act("refund", async () => {
    const updated = await updateAdminOrderRefund(orderId, next, next === "failed" ? failureReason.trim() : undefined);
    setDetail(updated); onChanged(updated); setFailureReason("");
    return `Đã cập nhật quy trình hoàn tiền mô phỏng sang “${statusStyle("refund", next).label.replace("Hoàn tiền (mô phỏng) · ", "")}”.`;
  });

  // Hoàn tất ngay: two transitions in one click (→ processing → completed); the server records both.
  const finishNow = () => act("refund", async () => {
    await updateAdminOrderRefund(orderId, "processing");
    const updated = await updateAdminOrderRefund(orderId, "completed");
    setDetail(updated); onChanged(updated);
    return "Đã hoàn tất mô phỏng (Đang xử lý → Hoàn tất).";
  });

  const tabs = detail ? [
    { value: "overview", label: "Tổng quan" },
    { value: "tickets", label: "Vé", count: detail.tickets.length },
    { value: "payments", label: "Thanh toán", count: detail.payments.length },
    { value: "emails", label: "Email", count: detail.emailLogs.length },
    ...(refundApplies ? [{ value: "refund", label: "Hoàn tiền" }] : []),
  ] : [];
  const activeTab = tab === "refund" && !refundApplies ? "overview" : tab;
  const steps = refund ? refundSteps(refund.status) : null;

  return (
    <SlideOver
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      size="lg"
      pending={busy !== null}
      title={detail ? `Đơn ${detail.orderCode}` : "Chi tiết đơn hàng"}
      description={detail ? `${detail.buyerName} · ${detail.buyerEmail}` : undefined}
      headerExtra={detail ? (
        <div className="od-head">
          <span className="od-flags">
            <StatusBadge domain="order" status={detail.status} />
            {refund && refund.status !== "not_required" && <StatusBadge domain="refund" status={refund.status} size="sm" />}
          </span>
          <strong className="od-total tb-num">{formatMoney(detail.totalAmount)}<small> · {formatNumber(detail.totalQuantity)} vé · mô phỏng</small></strong>
        </div>
      ) : undefined}
      footer={detail ? <>
        <Button disabled={busy !== null} onClick={onClose}>Đóng</Button>
        {detail.status === "pending_payment" && <Button variant="danger" icon={Ban} disabled={busy !== null} onClick={() => { setError(""); setConfirmCancel(true); }}>Hủy đơn</Button>}
      </> : undefined}
    >
      {loadError && !detail ? <ErrorState title="Không tải được đơn hàng" description={loadError} onRetry={() => { setLoadError(""); setReload((value) => value + 1); }} />
        : !detail ? <SkeletonBlock lines={8} label="Đang tải chi tiết đơn hàng" /> : (
        <div className="od">
          {error && <Notice tone="danger" title="Không thực hiện được">{error}</Notice>}
          {notice && <Notice tone="success" title={notice} />}
          <Tabs items={tabs} value={activeTab} onValueChange={(value) => setTab(value as OrderTab)} ariaLabel="Thông tin đơn hàng">
            <TabPanel value="overview">
              <dl className="od-dl">
                <Row label="Sự kiện">{detail.eventName} <span className="od-muted">#{detail.eventId}</span> <StatusBadge domain="event" status={detail.eventStatus} size="sm" /></Row>
                <Row label="Người mua">{detail.buyerName}</Row>
                <Row label="Email">{detail.buyerEmail}</Row>
                <Row label="Điện thoại">{detail.buyerPhone ?? "—"}</Row>
                <Row label="Tạo lúc"><span className="tb-num">{formatDateTime(detail.createdAt)}</span></Row>
                {detail.expiresAt && detail.status === "pending_payment" && <Row label="Giữ vé đến"><span className="tb-num">{formatDateTime(detail.expiresAt)}</span></Row>}
                {detail.confirmedAt && <Row label="Xác nhận lúc"><span className="tb-num">{formatDateTime(detail.confirmedAt)}</span></Row>}
                {detail.expiredAt && <Row label="Hết hạn lúc"><span className="tb-num">{formatDateTime(detail.expiredAt)}</span></Row>}
                {detail.cancelledAt && <Row label="Hủy lúc"><span className="tb-num">{formatDateTime(detail.cancelledAt)}</span></Row>}
              </dl>
              <h3 className="od-h">Hạng vé</h3>
              {detail.items.length === 0 ? <p className="od-muted">Không có dữ liệu.</p> : (
                <table className="od-items">
                  <caption className="sr-only">Hạng vé trong đơn</caption>
                  <thead><tr><th scope="col">Hạng vé</th><th scope="col" className="is-num">SL</th><th scope="col" className="is-num">Đơn giá</th><th scope="col" className="is-num">Thành tiền</th></tr></thead>
                  <tbody>{detail.items.map((item) => (
                    <tr key={item.id}><td>{item.ticketTypeName}</td><td className="is-num tb-num">{item.quantity}</td><td className="is-num tb-num">{formatMoney(item.unitPrice)}</td><td className="is-num tb-num">{formatMoney(item.lineTotal)}</td></tr>
                  ))}</tbody>
                  <tfoot>
                    {detail.discountAmount > 0 && <tr><th scope="row" colSpan={3}>Giảm giá</th><td className="is-num tb-num">−{formatMoney(detail.discountAmount)}</td></tr>}
                    <tr><th scope="row" colSpan={3}>Tổng (mô phỏng)</th><td className="is-num tb-num"><strong>{formatMoney(detail.totalAmount)}</strong></td></tr>
                  </tfoot>
                </table>
              )}
              <p className="od-rule">
                {detail.status === "pending_payment" ? "Chỉ đơn đang chờ thanh toán mới hủy trực tiếp được; hủy sẽ trả lại số vé đang giữ."
                  : detail.status === "confirmed" && detail.eventStatus === "cancelled" ? "Sự kiện đã hủy: đơn giữ nguyên lịch sử; hoàn tiền mô phỏng xử lý ở tab Hoàn tiền."
                  : detail.status === "confirmed" ? "Đơn đã mua thành công không hủy hoặc hoàn tiền được khi sự kiện còn hiệu lực."
                  : "Đơn đã đóng; chỉ xem lịch sử."}
              </p>
            </TabPanel>

            <TabPanel value="tickets">
              {detail.tickets.length === 0 ? <p className="od-muted">Chưa phát hành vé.</p> : (
                <ul className="od-list">{detail.tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <span className="od-list-main"><strong className="od-code">{ticket.ticketCode}</strong><span>{ticket.holderName ?? detail.buyerName} · {ticket.holderEmail ?? detail.buyerEmail}</span></span>
                    <span className="od-list-side"><StatusBadge domain="ticket" status={ticket.status} size="sm" /><span className="tb-num">{formatDateTime(ticket.checkedInAt ?? ticket.cancelledAt ?? ticket.issuedAt)}</span></span>
                  </li>
                ))}</ul>
              )}
            </TabPanel>

            <TabPanel value="payments">
              <Notice tone="info" title="Thanh toán là mô phỏng">Không có tiền thật được chuyển; trạng thái chỉ phục vụ quy trình của đồ án.</Notice>
              {detail.payments.length === 0 ? <p className="od-muted">Chưa có thanh toán.</p> : (
                <ul className="od-list">{detail.payments.map((payment) => (
                  <li key={payment.id}>
                    <span className="od-list-main"><strong className="od-code">{payment.paymentCode}</strong><span>{payment.method === "free" ? "Miễn phí" : "Mô phỏng"} · <span className="tb-num">{formatMoney(payment.amount)}</span>{payment.failureReason ? ` · ${payment.failureReason}` : ""}</span></span>
                    <span className="od-list-side"><StatusBadge domain="payment" status={payment.status} size="sm" /><span className="tb-num">{formatDateTime(payment.paidAt ?? payment.createdAt)}</span></span>
                  </li>
                ))}</ul>
              )}
            </TabPanel>

            <TabPanel value="emails">
              <div className="od-tab-actions"><Button size="sm" icon={RefreshCcw} loading={busy === "refresh"} disabled={busy !== null && busy !== "refresh"} onClick={() => void refreshEmails()}>Cập nhật trạng thái</Button></div>
              {detail.emailLogs.length === 0 ? <p className="od-muted">Chưa có email nào.</p> : (
                <ul className="od-list">{detail.emailLogs.map((log) => (
                  <li key={log.id}>
                    <span className="od-list-main">
                      <strong>{EMAIL_TYPE_LABEL[log.emailType]}</strong>
                      <span>{log.recipient} · lần thử {log.attemptCount} · <span className="tb-num">{formatDateTime(log.sentAt ?? log.createdAt)}</span></span>
                      {log.nextAttemptAt && <span className="tb-num">{log.status === "processing" ? "Hạn xử lý" : "Thử lại lúc"}: {formatDateTime(log.nextAttemptAt)}</span>}
                      {log.errorMessage && <span className="od-error">{log.errorMessage}</span>}
                    </span>
                    <span className="od-list-side">
                      <StatusBadge domain="email" status={log.status} size="sm" />
                      {canRetryEmail(log, detail, now) && <Button size="sm" loading={busy === "retry"} disabled={busy !== null && busy !== "retry"} onClick={() => void retry(log.id)} aria-label={`Thử gửi lại email số ${log.id}`}>Thử gửi lại</Button>}
                    </span>
                  </li>
                ))}</ul>
              )}
            </TabPanel>

            {refundApplies && refund && steps && (
              <TabPanel value="refund">
                <Notice tone="warning" title="Mô phỏng phục vụ đồ án">Không gọi ngân hàng hoặc cổng thanh toán và không xác nhận khách đã nhận tiền thật.</Notice>
                <div className="od-refund-head">
                  <span><span className="od-muted">Số tiền mô phỏng</span><strong className="tb-num">{formatMoney(refund.amount)}</strong></span>
                  <StatusBadge domain="refund" status={refund.status} />
                </div>
                <dl className="od-dl">
                  <Row label="Lý do">{refund.reason}</Row>
                  <Row label="Ghi nhận"><span className="tb-num">{formatDateTime(refund.requestedAt)}</span></Row>
                  {refund.completedAt && <Row label="Hoàn tất mô phỏng"><span className="tb-num">{formatDateTime(refund.completedAt)}</span></Row>}
                  {refund.failureReason && <Row label="Lỗi gần nhất"><span className="od-error">{refund.failureReason}</span></Row>}
                </dl>
                <ol className="od-steps" aria-label="Tiến trình hoàn tiền mô phỏng">
                  {[["Đã ghi nhận", "Hệ thống tạo yêu cầu"], ["Đang xử lý", "Admin xác nhận mô phỏng"], [refund.status === "failed" ? "Thất bại" : "Hoàn tất", "Kết quả được lưu audit"]].map(([title, sub], index) => (
                    <li key={title} className={cn(`is-${steps[index]}`)} aria-current={steps[index] === "current" || (index === 2 && (steps[2] === "done" || steps[2] === "failed")) ? "step" : undefined}>
                      <span className="od-step-dot" aria-hidden="true">{steps[index] === "failed" ? <X size={13} /> : steps[index] === "done" ? <Check size={13} /> : index + 1}</span>
                      <span><strong>{title}</strong><small>{sub}</small></span>
                    </li>
                  ))}
                </ol>
                {refund.status === "pending" && (
                  <div className="od-step-action"><p>Hoàn tất ngay chạy cả hai bước (Đang xử lý → Hoàn tất) trong một lần bấm; hoặc chỉ bắt đầu xử lý để có thể ghi nhận thất bại.</p>
                    <span className="od-step-buttons">
                      <Button variant="primary" icon={CheckCheck} loading={busy === "refund"} onClick={() => void finishNow()}>Hoàn tất ngay</Button>
                      <Button icon={Clock3} disabled={busy !== null} onClick={() => void transition("processing")}>Chỉ bắt đầu xử lý</Button>
                    </span></div>
                )}
                {refund.status === "processing" && (
                  <div className="od-step-action">
                    <p>Chọn Hoàn tất nếu kịch bản xử lý thành công, hoặc ghi nhận thất bại kèm lý do.</p>
                    <Button variant="primary" icon={Check} loading={busy === "refund"} onClick={() => void transition("completed")}>Hoàn tất mô phỏng</Button>
                    <Field label="Lý do thất bại" hint={`${failureReason.trim().length}/5 ký tự tối thiểu`}>
                      {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} rows={2} maxLength={500} disabled={busy !== null} value={failureReason} onChange={(e) => setFailureReason(e.target.value)} placeholder="Nhập lý do cụ thể, ít nhất 5 ký tự" />}
                    </Field>
                    <Button variant="danger-ghost" icon={X} disabled={busy !== null || failureReason.trim().length < 5} disabledReason={failureReason.trim().length < 5 ? "Nhập lý do ít nhất 5 ký tự" : undefined} onClick={() => void transition("failed")}>Đánh dấu thất bại</Button>
                  </div>
                )}
                {refund.status === "failed" && (
                  <div className="od-step-action"><p>Lỗi trước đó được giữ trong lịch sử. Hoàn tất ngay thử lại và hoàn tất trong một lần bấm; hoặc chỉ đưa về Đang xử lý.</p>
                    <span className="od-step-buttons">
                      <Button variant="primary" icon={CheckCheck} loading={busy === "refund"} onClick={() => void finishNow()}>Hoàn tất ngay</Button>
                      <Button icon={RefreshCcw} disabled={busy !== null} onClick={() => void transition("processing")}>Thử lại xử lý</Button>
                    </span></div>
                )}
                {refund.status === "completed" && <Notice tone="success" title="Đã hoàn tất quy trình mô phỏng">Thanh toán thành công ban đầu và trạng thái đơn được giữ nguyên để kiểm toán.</Notice>}
              </TabPanel>
            )}
          </Tabs>
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={(next) => { if (!next) setConfirmCancel(false); }}
        title="Hủy đơn hàng?"
        description={detail ? `${detail.orderCode} · ${detail.buyerEmail}` : undefined}
        consequences={["Đơn chuyển sang Đã hủy và trả lại số vé đang giữ cho hạng vé.", "Chỉ áp dụng cho đơn đang chờ thanh toán; máy chủ kiểm tra lại."]}
        confirmLabel="Hủy đơn"
        pending={busy === "cancel"}
        error={confirmCancel ? error : undefined}
        onConfirm={() => void cancelOrder()}
      />
    </SlideOver>
  );
}
