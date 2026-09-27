import { Ban, ChevronLeft, ChevronRight, Eye, Mail, PackageSearch, ReceiptText, Search, Send, ShoppingCart, Ticket, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
    getAdminOrderStats,
    getAdminOrderFilterOptions,
    type OrderStats,
    cancelAdminOrder,
    getAdminOrder,
    listAdminOrders,
    resendAdminOrderEmail,
    retryAdminOrderEmail,
    updateAdminOrderRefund,
    type AdminOrderDetail,
    type AdminOrderListItem,
    type AdminOrderStatus,
    type ListOrdersFilters,
} from "@/services/admin-orders.service";

const statuses: AdminOrderStatus[] = ["pending_payment", "confirmed", "expired", "cancelled"];

function formatMoney(value: number) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
}

function formatDate(value: string | null) {
    return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

function statusLabel(status: string) {
    return ({ pending_payment: "Chờ thanh toán", confirmed: "Đã xác nhận", expired: "Hết hạn", cancelled: "Đã hủy", issued: "Đã phát hành", checked_in: "Đã check-in", not_required: "Không cần hoàn", pending: "Đang chờ", processing: "Đang xử lý", success: "Thành công", failed: "Thất bại", sent: "Đã gửi", ticket_issued: "Phát hành vé", ticket_resent: "Gửi lại vé", order_cancelled: "Thông báo hủy sự kiện" } as Record<string, string>)[status] ?? status;
}

function orderStatusClass(status: AdminOrderStatus) {
    if (status === "confirmed") return "ongoing";
    if (status === "pending_payment") return "draft";
    if (status === "expired") return "completed";
    return "cancelled";
}

export function AdminOrdersPage() {
    const dialogRef = useRef<HTMLDivElement>(null);
    const [statsResult, setStatsResult] = useState<{ eventId: string; data: OrderStats } | null>(null);
    const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
    const [eventOptions, setEventOptions] = useState<Array<{ id: number; name: string }>>([]);
    const [status, setStatus] = useState<"all" | AdminOrderStatus>("all");
    const [eventId, setEventId] = useState("");
    const [buyerEmail, setBuyerEmail] = useState("");
    const [debouncedEmail, setDebouncedEmail] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [refresh, setRefresh] = useState(0);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [refundFailureReason, setRefundFailureReason] = useState("");
    const [actionLoading, setActionLoading] = useState<"cancel" | "resend" | "retry" | "refresh" | "refund" | null>(null);
    const [notice, setNotice] = useState("");

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedEmail(buyerEmail.trim());
        }, 400);
        return () => window.clearTimeout(timer);
    }, [buyerEmail]);

    useEffect(() => {
        let active = true;
        async function loadOrders() {
            setLoading(true);
            setError("");
            const filters: ListOrdersFilters = { page, limit: pageSize };
            if (status !== "all") filters.status = status;
            if (eventId && Number(eventId) > 0) filters.eventId = Number(eventId);
            if (debouncedEmail) filters.buyerEmail = debouncedEmail;
            try {
                const response = await listAdminOrders(filters);
                if (!active) return;
                const nextTotal = response.meta?.total ?? response.data.length;
                const lastPage = Math.max(1, Math.ceil(nextTotal / pageSize));
                setTotal(nextTotal);
                if (page > lastPage) { setPage(lastPage); return; }
                setOrders(response.data);
            } catch (caught) {
                if (active) setError(caught instanceof Error ? caught.message : "Không thể tải danh sách đơn hàng.");
            } finally {
                if (active) setLoading(false);
            }
        }
        void loadOrders();
        return () => { active = false; };
    }, [status, eventId, debouncedEmail, page, pageSize, refresh]);

    useEffect(() => {
        let active = true;
        const requestedEventId = eventId;
        getAdminOrderStats(requestedEventId && Number(requestedEventId) > 0 ? Number(requestedEventId) : undefined)
            .then(result => { if (active) setStatsResult({ eventId: requestedEventId, data: result }); })
            .catch(() => { if (active) setStatsResult(null); });
        return () => { active = false; };
    }, [eventId, refresh]);

    useEffect(() => {
        let active = true;
        getAdminOrderFilterOptions().then(result => { if (active) setEventOptions(result.events); })
            .catch(() => { if (active) setEventOptions([]); });
        return () => { active = false; };
    }, [refresh]);

    useEffect(() => {
        if (!detail || detailLoading) return;
        const previous = document.activeElement as HTMLElement | null;
        const dialog = dialogRef.current;
        const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? []);
        focusable()[0]?.focus();
        function keydown(event: KeyboardEvent) {
            if (event.key === 'Escape') { event.preventDefault(); setDetail(null); }
            if (event.key === 'Tab') {
                const controls = focusable();
                const first = controls[0]; const last = controls.at(-1);
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        }
        dialog?.addEventListener('keydown', keydown);
        return () => { dialog?.removeEventListener('keydown', keydown); previous?.focus(); };
    }, [detail, detailLoading]);

    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const firstPageButton = Math.max(1, Math.min(page - 2, pageCount - 4));
    const pageButtons = Array.from({ length: Math.min(5, pageCount) }, (_, index) => firstPageButton + index);
    const filterPending = buyerEmail.trim() !== debouncedEmail;
    const paginationDisabled = loading || filterPending;
    async function openDetail(orderId: number) {
        setDetailLoading(true);
        setError("");
        setNotice("");
        setRefundFailureReason("");
        try {
            setDetail(await getAdminOrder(orderId));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Không thể tải chi tiết đơn hàng.");
        } finally {
            setDetailLoading(false);
        }
    }

    function selectMetric(nextStatus: "all" | AdminOrderStatus) {
        setStatus(nextStatus);
        setBuyerEmail("");
        setDebouncedEmail("");
        setPage(1);
    }

    function syncOrder(updated: AdminOrderDetail) {
        setDetail(updated);
        setOrders((current) => current.map((order) => order.id === updated.id ? {
            ...order,
            status: updated.status,
            expiresAt: updated.expiresAt,
            confirmedAt: updated.confirmedAt,
        } : order));
    }

    async function cancelOrder() {
        if (!detail || detail.status !== "pending_payment" || actionLoading) return;
        setActionLoading("cancel");
        setError("");
        setNotice("");
        try {
            const updated = await cancelAdminOrder(detail.id);
            syncOrder(updated);
            setRefresh(current => current + 1);
            setNotice("Đã hủy đơn hàng thành công.");
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Không thể hủy đơn hàng.");
        } finally {
            setActionLoading(null);
        }
    }

    async function resendEmail() {
        if (!detail || detail.status !== "confirmed") return;
        setActionLoading("resend");
        setError("");
        setNotice("");
        try {
            const result = await resendAdminOrderEmail(detail.id);
            setNotice(result.message);
            setDetail(await getAdminOrder(detail.id));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Không thể gửi lại email vé.");
        } finally {
            setActionLoading(null);
        }
    }

    async function retryEmail(logId: number) {
        if (!detail || actionLoading) return;
        setActionLoading("retry"); setError(""); setNotice("");
        try {
            const result = await retryAdminOrderEmail(detail.id, logId);
            setNotice(result.message);
            setDetail(await getAdminOrder(detail.id));
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể xếp lịch thử lại."); }
        finally { setActionLoading(null); }
    }

    async function refreshEmailStatus() {
        if (!detail || actionLoading) return;
        setActionLoading("refresh"); setError("");
        try { setDetail(await getAdminOrder(detail.id)); }
        catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể tải trạng thái email."); }
        finally { setActionLoading(null); }
    }

    async function transitionRefund(nextStatus: "processing" | "completed" | "failed") {
        if (!detail?.refund || actionLoading) return;
        setActionLoading("refund"); setError(""); setNotice("");
        try {
            const updated = await updateAdminOrderRefund(
                detail.id,
                nextStatus,
                nextStatus === "failed" ? refundFailureReason.trim() : undefined,
            );
            syncOrder(updated);
            setRefundFailureReason("");
            setRefresh(current => current + 1);
            setNotice(`Đã cập nhật hoàn tiền mô phỏng sang “${statusLabel(nextStatus)}”.`);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Không thể cập nhật hoàn tiền mô phỏng.");
        } finally { setActionLoading(null); }
    }

    const stats = statsResult?.eventId === eventId ? statsResult.data : null;
    const metricCards: Array<{ key: "all" | AdminOrderStatus; label: string; count: number | undefined }> = [
        { key: "all", label: "Tổng đơn hàng", count: stats?.total },
        { key: "pending_payment", label: "Chờ thanh toán", count: stats?.pendingPayment },
        { key: "confirmed", label: "Đã xác nhận", count: stats?.confirmed },
        { key: "expired", label: "Đã hết hạn", count: stats?.expired },
        { key: "cancelled", label: "Đã hủy", count: stats?.cancelled },
    ];

    return (
        <section className="factory-module-page events-admin-page">
            <header className="factory-module-hero">
                <div><div className="admin-live-label"><ShoppingCart size={13} /> QUẢN LÝ GIAO DỊCH</div><h2>Quản lý đơn hàng</h2><p>Tra cứu giao dịch, kiểm tra vé và xử lý đơn hàng.</p></div>
            </header>

            {error && <div role="alert" className="events-form-errors"><p>{error}</p></div>}

            <div className="factory-module-metrics" aria-busy={loading}>
                {metricCards.map(card => <button
                    key={card.key}
                    type="button"
                    className="factory-module-metric-button"
                    aria-pressed={status === card.key}
                    aria-label={`Lọc đơn hàng: ${card.label}`}
                    disabled={loading || !stats}
                    onClick={() => selectMetric(card.key)}
                ><span>{card.label}</span><strong>{loading || !stats ? '—' : card.count ?? 0}</strong></button>)}
            </div>

            <div className="events-toolbar">
                <label><Search size={16} /><input aria-label="Lọc email người mua" type="email" value={buyerEmail} onChange={(event) => { setBuyerEmail(event.target.value); setPage(1); }} placeholder="Tìm theo email người mua" /></label>
                <label><ReceiptText size={16} /><select aria-label="Lọc theo sự kiện" value={eventId} onChange={(event) => { setEventId(event.target.value); setPage(1); }}>
                    <option value="">Tất cả sự kiện</option>
                    {eventOptions.map(event => <option key={event.id} value={event.id}>{event.name}</option>)}
                </select></label>
                <select aria-label="Lọc trạng thái đơn" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}>
                    <option value="all">Tất cả trạng thái</option>
                    {statuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
                </select>
            </div>

            <div className="events-list-panel">
                {loading ? <div className="events-empty"><p>Đang tải đơn hàng...</p></div> : orders.length === 0 ? (
                    <div className="events-empty"><PackageSearch size={38} /><h3>{status === "all" ? "Không tìm thấy đơn hàng" : `Không có đơn ${statusLabel(status).toLowerCase()}`}</h3><p>Hãy thay đổi bộ lọc trạng thái, sự kiện hoặc email người mua.</p></div>
                ) : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                    <caption className="sr-only">Danh sách đơn hàng</caption>
                    <thead><tr>{['Mã đơn', 'Người mua', 'Sự kiện', 'Tổng tiền', 'Trạng thái', 'Ngày tạo', 'Chi tiết'].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
                    <tbody>{orders.map(order => <tr key={order.id} className="border-t border-white/10">
                        <td className="p-3">{order.orderCode}</td>
                        <td className="p-3">{order.buyerName}<br />{order.buyerEmail}</td>
                        <td className="p-3">{order.eventName}</td>
                        <td className="p-3">{formatMoney(order.totalAmount)}</td>
                        <td className="p-3"><span className={`event-status ${orderStatusClass(order.status)}`}>{statusLabel(order.status)}</span></td>
                        <td className="p-3">{formatDate(order.createdAt)}</td>
                        <td className="p-3 events-actions"><button onClick={() => void openDetail(order.id)} aria-label={`Xem đơn ${order.orderCode}`}><Eye size={16} /></button></td>
                    </tr>)}</tbody>
                </table></div>}

            </div>

            <nav aria-label="Phân trang đơn hàng" className="flex flex-wrap items-center justify-between gap-4">
                <p role="status" className="text-sm text-muted-foreground">Trang {page} / {pageCount} · {total} đơn hàng</p>
                <label className="flex items-center gap-2 text-sm">Đơn mỗi trang
                    <select value={pageSize} disabled={loading} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded-lg border border-white/20 bg-card px-2 py-2 focus-visible:outline-2 focus-visible:outline-primary">
                        {[10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}
                    </select>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" disabled={page <= 1 || paginationDisabled} onClick={() => setPage(1)} aria-label="Trang đầu" className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40">Đầu</button>
                    <button type="button" disabled={page <= 1 || paginationDisabled} onClick={() => setPage(current => Math.max(1, current - 1))} aria-label="Trang trước" className="rounded-lg border border-white/20 p-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={18} /></button>
                    {pageButtons.map(number => <button key={number} type="button" aria-label={`Trang ${number}`} aria-current={page === number ? "page" : undefined} disabled={paginationDisabled || page === number} onClick={() => setPage(number)} className={`min-w-9 rounded-lg border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default ${page === number ? "border-primary bg-primary text-white" : "border-white/20 hover:bg-white/10 disabled:opacity-40"}`}>{number}</button>)}
                    <button type="button" disabled={page >= pageCount || paginationDisabled} onClick={() => setPage(current => Math.min(pageCount, current + 1))} aria-label="Trang sau" className="rounded-lg border border-white/20 p-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={18} /></button>
                    <button type="button" disabled={page >= pageCount || paginationDisabled} onClick={() => setPage(pageCount)} aria-label="Trang cuối" className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40">Cuối</button>
                </div>
            </nav>

            {detailLoading && <div className="events-dialog-backdrop"><div className="events-dialog"><div className="events-empty"><p>Đang tải chi tiết...</p></div></div></div>}

            {detail && !detailLoading && <div className="events-dialog-backdrop" role="presentation"><div ref={dialogRef} className="events-dialog" role="dialog" aria-modal="true" aria-labelledby="order-dialog-title">
                <header><div><span>QUẢN TRỊ / ĐƠN HÀNG / #{detail.id}</span><h3 id="order-dialog-title">{detail.orderCode}</h3></div><button onClick={() => setDetail(null)} aria-label="Đóng chi tiết đơn hàng"><X size={20} /></button></header>
                <form onSubmit={(event) => event.preventDefault()}>
                    {error && <div role="alert" className="events-form-errors"><p>{error}</p></div>}
                    {notice && <div className="events-rule-banner"><Mail size={18} /><div><strong>{notice}</strong></div></div>}
                    <div className="events-form-grid">
                        <label>Trạng thái<input readOnly value={statusLabel(detail.status)} /></label>
                        <label>Sự kiện<input readOnly value={`${detail.eventName} (#${detail.eventId})`} /></label>
                        <label>Người mua<input readOnly value={detail.buyerName} /></label>
                        <label>Email<input readOnly value={detail.buyerEmail} /></label>
                        <label>Điện thoại<input readOnly value={detail.buyerPhone ?? "—"} /></label>
                        <label>Ngày tạo<input readOnly value={formatDate(detail.createdAt)} /></label>
                        <label>Tổng số vé<input readOnly value={detail.totalQuantity} /></label>
                        <label>Tổng tiền<input readOnly value={formatMoney(detail.totalAmount)} /></label>
                    </div>

                    <fieldset className="events-publish-box"><legend>Chi tiết hạng vé</legend>{detail.items.length === 0 ? <small>Không có dữ liệu.</small> : detail.items.map((item) => <label key={item.id}><Ticket size={14} /> {item.ticketTypeName} · {item.quantity} × {formatMoney(item.unitPrice)} = {formatMoney(item.lineTotal)}</label>)}</fieldset>
                    <fieldset className="events-publish-box"><legend>Vé đã phát hành</legend>{detail.tickets.length === 0 ? <small>Chưa phát hành vé.</small> : detail.tickets.map((ticket) => <label key={ticket.id}><span className={`event-status ${ticket.status === "issued" ? "published" : ticket.status === "checked_in" ? "ongoing" : "cancelled"}`}>{statusLabel(ticket.status)}</span> {ticket.ticketCode} · {ticket.holderName ?? detail.buyerName} · {ticket.holderEmail ?? detail.buyerEmail}</label>)}</fieldset>
                    <fieldset className="events-publish-box"><legend>Thanh toán mô phỏng</legend>{detail.payments.length === 0 ? <small>Chưa có thanh toán.</small> : detail.payments.map((payment) => <label key={payment.id}><span className={`event-status ${payment.status === "success" ? "ongoing" : payment.status === "failed" || payment.status === "cancelled" ? "cancelled" : "draft"}`}>{statusLabel(payment.status)}</span> {payment.paymentCode} · {payment.method === "free" ? "Miễn phí" : "Mô phỏng"} · {formatMoney(payment.amount)} · {formatDate(payment.paidAt ?? payment.createdAt)}</label>)}</fieldset>
                    <fieldset className="events-publish-box"><legend>Hoàn tiền mô phỏng</legend>
                        {!detail.refund ? <small>Đơn hàng chưa có yêu cầu hoàn tiền mô phỏng.</small> : <div className="space-y-3">
                            <p><span className={`event-status ${detail.refund.status === "completed" ? "ongoing" : detail.refund.status === "failed" ? "cancelled" : "draft"}`}>{statusLabel(detail.refund.status)}</span> · {formatMoney(detail.refund.amount)}</p>
                            <p>Lý do: {detail.refund.reason}</p>
                            <p>Ghi nhận lúc: {formatDate(detail.refund.requestedAt)}{detail.refund.completedAt ? ` · Hoàn tất lúc: ${formatDate(detail.refund.completedAt)}` : ""}</p>
                            {detail.refund.failureReason && <p className="text-red-400">Lỗi: {detail.refund.failureReason}</p>}
                            <p className="text-xs text-muted-foreground">Đây là quy trình mô phỏng phục vụ đồ án, không xác nhận giao dịch với ngân hàng hoặc cổng thanh toán.</p>
                            {detail.refund.status === "pending" && <button type="button" disabled={actionLoading !== null} onClick={() => void transitionRefund("processing")} className="focus-visible:outline-2 hover:underline disabled:opacity-50">Bắt đầu xử lý mô phỏng</button>}
                            {detail.refund.status === "processing" && <div className="space-y-2">
                                <label htmlFor="refund-failure-reason">Lý do nếu xử lý thất bại</label>
                                <input id="refund-failure-reason" minLength={5} maxLength={500} disabled={actionLoading !== null} value={refundFailureReason} onChange={event => setRefundFailureReason(event.target.value)} placeholder="Nhập ít nhất 5 ký tự" />
                                <div className="flex flex-wrap gap-2">
                                    <button type="button" disabled={actionLoading !== null} onClick={() => void transitionRefund("completed")} className="focus-visible:outline-2 hover:underline disabled:opacity-50">Hoàn tất mô phỏng</button>
                                    <button type="button" disabled={actionLoading !== null || refundFailureReason.trim().length < 5} onClick={() => void transitionRefund("failed")} className="focus-visible:outline-2 hover:underline disabled:opacity-50">Đánh dấu thất bại</button>
                                </div>
                            </div>}
                            {detail.refund.status === "failed" && <button type="button" disabled={actionLoading !== null} onClick={() => void transitionRefund("processing")} className="focus-visible:outline-2 hover:underline disabled:opacity-50">Thử lại xử lý mô phỏng</button>}
                        </div>}
                    </fieldset>
                    <fieldset className="events-publish-box"><legend>Lịch sử gửi email</legend>
                        <button type="button" disabled={actionLoading !== null} onClick={() => void refreshEmailStatus()} className="focus-visible:outline-2 hover:underline">{actionLoading === "refresh" ? "Đang tải..." : "Cập nhật trạng thái"}</button>
                        {detail.emailLogs.length === 0 ? <small>Chưa có email log.</small> : detail.emailLogs.map(log => (
                            <div key={log.id} className="space-y-1 border-t border-white/10 py-2">
                                <p><span className={`event-status ${log.status === "sent" ? "ongoing" : log.status === "failed" ? "cancelled" : "draft"}`}>{statusLabel(log.status)}</span> {statusLabel(log.emailType)} · {log.recipient}</p>
                                <p>Lần thử: {log.attemptCount} · {formatDate(log.sentAt ?? log.createdAt)}</p>
                                {log.nextAttemptAt && <p>{log.status === "processing" ? "Hạn xử lý" : "Thử lại lúc"}: {formatDate(log.nextAttemptAt)}</p>}
                                {log.errorMessage && <p className="text-red-400">{log.errorMessage}</p>}
                                {log.status === "failed" && log.emailType !== "order_cancelled" && <button type="button" aria-label={`Thử gửi lại email số ${log.id}`} className="focus-visible:outline-2 hover:underline disabled:opacity-50"
                                    disabled={actionLoading !== null || detail.status !== "confirmed" || detail.emailLogs.some(active => active.emailType === log.emailType && ["pending", "processing"].includes(active.status))}
                                    onClick={() => void retryEmail(log.id)}>{actionLoading === "retry" ? "Đang xếp lịch..." : "Thử gửi lại"}</button>}
                            </div>
                        ))}
                    </fieldset>

                    {detail.status === "pending_payment" && <p className="text-sm text-muted-foreground">Chỉ đơn đang chờ thanh toán mới có thể hủy trực tiếp. Thao tác này giải phóng số vé đang giữ.</p>}
                    {detail.status === "confirmed" && <p className="text-sm text-muted-foreground">Đơn đã thanh toán — không thể huỷ trực tiếp tại đây</p>}

                    <footer>
                        <button type="button" onClick={() => setDetail(null)}>Đóng</button>
                        <button type="button" disabled={detail.status !== "confirmed" || actionLoading !== null} onClick={() => void resendEmail()}><Send size={14} /> {actionLoading === "resend" ? "Đang xếp lịch..." : "Gửi lại email vé"}</button>
                        {detail.status === "pending_payment" && <button className="primary" type="button" disabled={actionLoading !== null} onClick={() => void cancelOrder()}><Ban size={14} /> {actionLoading === "cancel" ? "Đang hủy..." : "Hủy đơn"}</button>}
                    </footer>
                </form>
            </div></div>}
        </section>
    );
}
