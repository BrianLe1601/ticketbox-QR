import { Ban, ChevronLeft, ChevronRight, Eye, Mail, PackageSearch, ReceiptText, Search, Send, ShoppingCart, Ticket, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
    cancelAdminOrder,
    getAdminOrder,
    listAdminOrders,
    resendAdminOrderEmail,
    type AdminOrderDetail,
    type AdminOrderListItem,
    type AdminOrderStatus,
    type ListOrdersFilters,
} from "@/services/admin-orders.service";

const PAGE_SIZE = 20;
const statuses: AdminOrderStatus[] = ["pending_payment", "confirmed", "expired", "cancelled"];

function formatMoney(value: number) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
}

function formatDate(value: string | null) {
    return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

function statusLabel(status: string) {
    return status.replaceAll("_", " ");
}

function orderStatusClass(status: AdminOrderStatus) {
    if (status === "confirmed") return "ongoing";
    if (status === "pending_payment") return "draft";
    if (status === "expired") return "completed";
    return "cancelled";
}

export function AdminOrdersPage() {
    const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
    const [status, setStatus] = useState<"all" | AdminOrderStatus>("all");
    const [eventId, setEventId] = useState("");
    const [buyerEmail, setBuyerEmail] = useState("");
    const [debouncedEmail, setDebouncedEmail] = useState("");
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [actionLoading, setActionLoading] = useState<"cancel" | "resend" | null>(null);
    const [notice, setNotice] = useState("");

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedEmail(buyerEmail.trim());
            setPage(1);
        }, 400);
        return () => window.clearTimeout(timer);
    }, [buyerEmail]);

    useEffect(() => {
        let active = true;
        async function loadOrders() {
            setLoading(true);
            setError("");
            const filters: ListOrdersFilters = { page, limit: PAGE_SIZE };
            if (status !== "all") filters.status = status;
            if (eventId && Number(eventId) > 0) filters.eventId = Number(eventId);
            if (debouncedEmail) filters.buyerEmail = debouncedEmail;
            try {
                const response = await listAdminOrders(filters);
                if (!active) return;
                setOrders(response.data);
                setTotal(response.meta?.total ?? response.data.length);
            } catch (caught) {
                if (active) setError(caught instanceof Error ? caught.message : "Không thể tải danh sách đơn hàng.");
            } finally {
                if (active) setLoading(false);
            }
        }
        void loadOrders();
        return () => { active = false; };
    }, [status, eventId, debouncedEmail, page]);

    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const counts = useMemo(() => ({
        visible: orders.length,
        confirmed: orders.filter((order) => order.status === "confirmed").length,
        pending: orders.filter((order) => order.status === "pending_payment").length,
        revenue: orders.filter((order) => order.status === "confirmed").reduce((sum, order) => sum + order.totalAmount, 0),
    }), [orders]);

    async function openDetail(orderId: number) {
        setDetailLoading(true);
        setError("");
        setNotice("");
        setCancelReason("");
        try {
            setDetail(await getAdminOrder(orderId));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Không thể tải chi tiết đơn hàng.");
        } finally {
            setDetailLoading(false);
        }
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
        if (!detail || !["pending_payment", "confirmed"].includes(detail.status)) return;
        setActionLoading("cancel");
        setError("");
        setNotice("");
        try {
            const updated = cancelReason.trim()
                ? await cancelAdminOrder(detail.id, cancelReason.trim())
                : await cancelAdminOrder(detail.id);
            syncOrder(updated);
            setCancelReason("");
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
            setNotice(`Đã gửi lại ${result.ticketCount} vé tới ${result.buyerEmail}.`);
            setDetail(await getAdminOrder(detail.id));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Không thể gửi lại email vé.");
        } finally {
            setActionLoading(null);
        }
    }

    return (
        <section className="events-admin-page">
            <header className="events-page-header">
                <div><div className="admin-live-label"><ShoppingCart size={13} /> ORDER OPERATIONS</div><h2>Order Management</h2><p>Tra cứu giao dịch, kiểm tra vé và xử lý đơn hàng.</p></div>
            </header>

            {error && <div className="events-form-errors"><p>{error}</p></div>}

            <div className="events-metric-grid">
                <article><span>Total results</span><strong>{total}</strong></article>
                <article><span>Visible orders</span><strong>{counts.visible}</strong></article>
                <article><span>Confirmed / Pending</span><strong>{counts.confirmed} / {counts.pending}</strong></article>
                <article><span>Confirmed value on page</span><strong>{formatMoney(counts.revenue)}</strong></article>
            </div>

            <div className="events-toolbar">
                <label><Search size={16} /><input type="email" value={buyerEmail} onChange={(event) => setBuyerEmail(event.target.value)} placeholder="Tìm theo email người mua" /></label>
                <label><ReceiptText size={16} /><input type="number" min="1" value={eventId} onChange={(event) => { setEventId(event.target.value); setPage(1); }} placeholder="Event ID" /></label>
                <select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}>
                    <option value="all">All statuses</option>
                    {statuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
                </select>
            </div>

            <div className="events-list-panel">
                {loading ? <div className="events-empty"><p>Loading orders...</p></div> : orders.length === 0 ? (
                    <div className="events-empty"><PackageSearch size={38} /><h3>Không tìm thấy đơn hàng</h3><p>Hãy thay đổi bộ lọc trạng thái, sự kiện hoặc email người mua.</p></div>
                ) : orders.map((order) => (
                    <article className="events-row" key={order.id}>
                        <div className="events-date"><Ticket size={18} /><strong>#{order.id}</strong></div>
                        <div className="events-main">
                            <div><span className={`event-status ${orderStatusClass(order.status)}`}>{statusLabel(order.status)}</span></div>
                            <h3>{order.orderCode} · {order.eventName}</h3>
                            <p>{order.buyerName} · {order.buyerEmail} · {formatDate(order.createdAt)}</p>
                        </div>
                        <div className="events-ticket-health"><Ticket size={16} /><strong>{order.totalQuantity}</strong><span>{formatMoney(order.totalAmount)}</span></div>
                        <div className="events-actions"><button onClick={() => void openDetail(order.id)} aria-label={`Xem đơn ${order.orderCode}`}><Eye size={16} /></button></div>
                    </article>
                ))}
            </div>

            <div className="events-page-header">
                <p>Trang {page} / {pageCount} · {total} đơn hàng</p>
                <div className="events-actions">
                    <button disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} aria-label="Trang trước"><ChevronLeft size={16} /></button>
                    <button disabled={page >= pageCount || loading} onClick={() => setPage((current) => current + 1)} aria-label="Trang sau"><ChevronRight size={16} /></button>
                </div>
            </div>

            {detailLoading && <div className="events-dialog-backdrop"><div className="events-dialog"><div className="events-empty"><p>Loading order detail...</p></div></div></div>}

            {detail && !detailLoading && <div className="events-dialog-backdrop" role="presentation"><div className="events-dialog" role="dialog" aria-modal="true" aria-labelledby="order-dialog-title">
                <header><div><span>ADMIN / ORDERS / #{detail.id}</span><h3 id="order-dialog-title">{detail.orderCode}</h3></div><button onClick={() => setDetail(null)} aria-label="Close"><X size={20} /></button></header>
                <form onSubmit={(event) => event.preventDefault()}>
                    {error && <div className="events-form-errors"><p>{error}</p></div>}
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

                    <fieldset className="events-publish-box"><legend>Order items</legend>{detail.items.length === 0 ? <small>Không có dữ liệu.</small> : detail.items.map((item) => <label key={item.id}><Ticket size={14} /> {item.ticketTypeName} · {item.quantity} × {formatMoney(item.unitPrice)} = {formatMoney(item.lineTotal)}</label>)}</fieldset>
                    <fieldset className="events-publish-box"><legend>Tickets</legend>{detail.tickets.length === 0 ? <small>Chưa phát hành vé.</small> : detail.tickets.map((ticket) => <label key={ticket.id}><span className={`event-status ${ticket.status === "issued" ? "published" : ticket.status === "checked_in" ? "ongoing" : "cancelled"}`}>{statusLabel(ticket.status)}</span> {ticket.ticketCode} · {ticket.holderName ?? detail.buyerName} · {ticket.holderEmail ?? detail.buyerEmail}</label>)}</fieldset>
                    <fieldset className="events-publish-box"><legend>Payments</legend>{detail.payments.length === 0 ? <small>Chưa có thanh toán.</small> : detail.payments.map((payment) => <label key={payment.id}><span className={`event-status ${payment.status === "success" ? "ongoing" : payment.status === "failed" || payment.status === "cancelled" ? "cancelled" : "draft"}`}>{payment.status}</span> {payment.paymentCode} · {payment.method} · {formatMoney(payment.amount)} · {formatDate(payment.paidAt ?? payment.createdAt)}</label>)}</fieldset>
                    <fieldset className="events-publish-box"><legend>Email logs</legend>{detail.emailLogs.length === 0 ? <small>Chưa có email log.</small> : detail.emailLogs.map((log) => <label key={log.id}><span className={`event-status ${log.status === "sent" ? "ongoing" : log.status === "failed" ? "cancelled" : "draft"}`}>{log.status}</span> {statusLabel(log.emailType)} · {log.recipient} · {formatDate(log.sentAt ?? log.createdAt)}{log.errorMessage ? ` · ${log.errorMessage}` : ""}</label>)}</fieldset>

                    {["pending_payment", "confirmed"].includes(detail.status) && <fieldset className="events-publish-box"><legend>Hủy đơn thủ công</legend><label>Lý do hủy (không bắt buộc)</label><input maxLength={255} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Nhập lý do hủy đơn" /><small>Với đơn đã xác nhận, chỉ các vé chưa check-in sẽ bị hủy và hoàn tồn kho.</small></fieldset>}

                    <footer>
                        <button type="button" onClick={() => setDetail(null)}>Đóng</button>
                        <button type="button" disabled={detail.status !== "confirmed" || actionLoading !== null} onClick={() => void resendEmail()}><Send size={14} /> {actionLoading === "resend" ? "Đang gửi..." : "Gửi lại email vé"}</button>
                        <button className="primary" type="button" disabled={!(["pending_payment", "confirmed"].includes(detail.status)) || actionLoading !== null} onClick={() => void cancelOrder()}><Ban size={14} /> {actionLoading === "cancel" ? "Đang hủy..." : "Hủy đơn"}</button>
                    </footer>
                </form>
            </div></div>}
        </section>
    );
}
