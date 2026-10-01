import { AlertTriangle, Ban, Check, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, Eye, Mail, PackageSearch, ReceiptText, RefreshCcw, Search, Send, ShoppingCart, Ticket, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    getAdminOrderStats,
    getAdminOrderFilterOptions,
    type OrderStats,
    cancelAdminOrder,
    getAdminOrder,
    listAdminOrders,
    resendAdminOrderEmail,
    retryAdminOrderEmail,
    updateAdminEventRefunds,
    updateAdminOrderRefund,
    type AdminOrderDetail,
    type AdminOrderListItem,
    type AdminOrderEventOption,
    type AdminOrderStatus,
    type RefundStatus,
    type ListOrdersFilters,
} from "@/services/admin-orders.service";

const ORDERS_PAGE_SIZE = 8;

const statuses: AdminOrderStatus[] = ["pending_payment", "confirmed", "expired", "cancelled"];

function formatMoney(value: number) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
}

function formatDate(value: string | null) {
    return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

function statusLabel(status: string) {
    return ({ pending_payment: "Chờ thanh toán", confirmed: "Đã xác nhận", expired: "Hết hạn", cancelled: "Đã hủy", draft: "Bản nháp", published: "Đã công bố", ongoing: "Đang diễn ra", issued: "Đã phát hành", checked_in: "Đã check-in", not_required: "Không cần hoàn", pending: "Đang chờ", processing: "Đang xử lý", completed: "Hoàn tất", success: "Thành công", failed: "Thất bại", sent: "Đã gửi", ticket_issued: "Phát hành vé", ticket_resent: "Gửi lại vé", order_cancelled: "Thông báo hủy sự kiện" } as Record<string, string>)[status] ?? status;
}

function orderStatusClass(status: AdminOrderStatus) {
    if (status === "confirmed") return "ongoing";
    if (status === "pending_payment") return "draft";
    if (status === "expired") return "completed";
    return "cancelled";
}

function refundStatusClass(status: RefundStatus) {
    if (status === "completed") return "ongoing";
    if (status === "failed") return "cancelled";
    return "draft";
}

function refundStepClass(status: RefundStatus, step: "pending" | "processing" | "result") {
    if (step === "pending") return "is-complete";
    if (step === "processing") {
        return status === "pending" ? "" : "is-complete";
    }
    if (status === "completed") return "is-complete";
    if (status === "failed") return "is-failed";
    return "";
}

export function AdminOrdersPage() {
    const dialogRef = useRef<HTMLDivElement>(null);
    const refundDialogRef = useRef<HTMLDivElement>(null);
    const bulkRefundDialogRef = useRef<HTMLDivElement>(null);
    const [statsResult, setStatsResult] = useState<{ eventId: string; data: OrderStats } | null>(null);
    const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
    const [eventOptions, setEventOptions] = useState<AdminOrderEventOption[]>([]);
    const [status, setStatus] = useState<"all" | AdminOrderStatus>("all");
    const [eventId, setEventId] = useState("");
    const [buyerEmail, setBuyerEmail] = useState("");
    const [debouncedEmail, setDebouncedEmail] = useState("");
    const [page, setPage] = useState(1);
    const [refresh, setRefresh] = useState(0);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [refundDetail, setRefundDetail] = useState<AdminOrderDetail | null>(null);
    const [refundLoadingOrderId, setRefundLoadingOrderId] = useState<number | null>(null);
    const [refundFailureReason, setRefundFailureReason] = useState("");
    const [actionLoading, setActionLoading] = useState<"cancel" | "resend" | "retry" | "refresh" | "refund" | null>(null);
    const [notice, setNotice] = useState("");
    const [refundError, setRefundError] = useState("");
    const [refundNotice, setRefundNotice] = useState("");
    const [pageNotice, setPageNotice] = useState("");
    const [bulkRefundTarget, setBulkRefundTarget] = useState<"processing" | "completed" | null>(null);
    const [bulkRefundLoading, setBulkRefundLoading] = useState(false);

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
            const filters: ListOrdersFilters = { page, limit: ORDERS_PAGE_SIZE };
            if (status !== "all") filters.status = status;
            if (eventId && Number(eventId) > 0) filters.eventId = Number(eventId);
            if (debouncedEmail) filters.buyerEmail = debouncedEmail;
            try {
                const response = await listAdminOrders(filters);
                if (!active) return;
                const nextTotal = response.meta?.total ?? response.data.length;
                const lastPage = Math.max(1, Math.ceil(nextTotal / ORDERS_PAGE_SIZE));
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
    }, [status, eventId, debouncedEmail, page, refresh]);

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

    useEffect(() => {
        if (!refundDetail) return;
        const previous = document.activeElement as HTMLElement | null;
        const dialog = refundDialogRef.current;
        const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? []);
        focusable()[0]?.focus();
        function keydown(event: KeyboardEvent) {
            if (event.key === "Escape" && actionLoading !== "refund") {
                event.preventDefault();
                setRefundDetail(null);
            }
            if (event.key === "Tab") {
                const controls = focusable();
                const first = controls[0];
                const last = controls.at(-1);
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        }
        dialog?.addEventListener("keydown", keydown);
        return () => { dialog?.removeEventListener("keydown", keydown); previous?.focus(); };
    }, [refundDetail, actionLoading]);

    useEffect(() => {
        if (!bulkRefundTarget) return;
        const previous = document.activeElement as HTMLElement | null;
        const dialog = bulkRefundDialogRef.current;
        const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? []);
        focusable()[0]?.focus();
        function keydown(event: KeyboardEvent) {
            if (event.key === "Escape" && !bulkRefundLoading) {
                event.preventDefault();
                setBulkRefundTarget(null);
            }
            if (event.key === "Tab") {
                const controls = focusable();
                const first = controls[0];
                const last = controls.at(-1);
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        }
        dialog?.addEventListener("keydown", keydown);
        return () => { dialog?.removeEventListener("keydown", keydown); previous?.focus(); };
    }, [bulkRefundTarget, bulkRefundLoading]);

    const pageCount = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
    const filterPending = buyerEmail.trim() !== debouncedEmail;
    const paginationDisabled = loading || filterPending;
    const selectedEvent = eventOptions.find((event) => String(event.id) === eventId) ?? null;
    async function openDetail(orderId: number) {
        setRefundDetail(null);
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

    async function openRefund(orderId: number) {
        setDetail(null);
        setRefundLoadingOrderId(orderId);
        setError("");
        setRefundError("");
        setRefundNotice("");
        setRefundFailureReason("");
        try {
            const order = await getAdminOrder(orderId);
            if (order.eventStatus !== "cancelled" || !order.refund || order.refund.status === "not_required") {
                throw new Error("Refund chỉ áp dụng cho đơn cần hoàn tiền thuộc sự kiện đã hủy.");
            }
            setRefundDetail(order);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Không thể tải quy trình hoàn tiền mô phỏng.");
        } finally {
            setRefundLoadingOrderId(null);
        }
    }

    async function transitionEventRefunds() {
        if (!selectedEvent || selectedEvent.status !== "cancelled" || !bulkRefundTarget || bulkRefundLoading) return;
        setBulkRefundLoading(true);
        setError("");
        setPageNotice("");
        try {
            const result = await updateAdminEventRefunds(selectedEvent.id, bulkRefundTarget);
            setPageNotice(result.message);
            setBulkRefundTarget(null);
            setRefresh((current) => current + 1);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Không thể cập nhật hoàn tiền mô phỏng hàng loạt.");
        } finally {
            setBulkRefundLoading(false);
        }
    }

    function selectMetric(nextStatus: "all" | AdminOrderStatus) {
        setStatus(nextStatus);
        setBuyerEmail("");
        setDebouncedEmail("");
        setPage(1);
    }

    function syncOrder(updated: AdminOrderDetail) {
        setDetail((current) => current?.id === updated.id ? updated : current);
        setRefundDetail((current) => current?.id === updated.id ? updated : current);
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
        if (!refundDetail?.refund || actionLoading) return;
        setActionLoading("refund"); setRefundError(""); setRefundNotice("");
        try {
            const updated = await updateAdminOrderRefund(
                refundDetail.id,
                nextStatus,
                nextStatus === "failed" ? refundFailureReason.trim() : undefined,
            );
            syncOrder(updated);
            setRefundFailureReason("");
            setRefresh(current => current + 1);
            setRefundNotice(`Đã cập nhật quy trình hoàn tiền mô phỏng sang “${statusLabel(nextStatus)}”.`);
        } catch (caught) {
            setRefundError(caught instanceof Error ? caught.message : "Không thể cập nhật hoàn tiền mô phỏng.");
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
            {pageNotice && <div role="status" className="refund-success-banner order-page-notice"><Check size={18} /><strong>{pageNotice}</strong></div>}

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
                    {eventOptions.map(event => <option key={event.id} value={event.id}>{event.name}{event.status === "cancelled" ? " · Đã hủy" : ""}</option>)}
                </select></label>
                <select aria-label="Lọc trạng thái đơn" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}>
                    <option value="all">Tất cả trạng thái</option>
                    {statuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
                </select>
            </div>

            {selectedEvent?.status === "cancelled" && <section className="event-refund-bulk-panel" aria-label="Hoàn tiền mô phỏng hàng loạt theo sự kiện">
                <div className="event-refund-bulk-heading">
                    <div><span><CircleDollarSign size={15} /> REFUND THEO SỰ KIỆN ĐÃ HỦY</span><h3>{selectedEvent.name}</h3><p>Chỉ các Order confirmed có yêu cầu hoàn tiền do hủy Event mới được xử lý. Payment và lịch sử Order không thay đổi.</p></div>
                    <span className="event-status cancelled">ĐÃ HỦY</span>
                </div>
                <div className="event-refund-bulk-metrics">
                    <div><span>Chờ xử lý</span><strong>{selectedEvent.refundSummary.pending}</strong></div>
                    <div><span>Đang xử lý</span><strong>{selectedEvent.refundSummary.processing}</strong></div>
                    <div><span>Thất bại</span><strong>{selectedEvent.refundSummary.failed}</strong></div>
                    <div><span>Hoàn tất</span><strong>{selectedEvent.refundSummary.completed}</strong></div>
                    <div><span>Không cần hoàn</span><strong>{selectedEvent.refundSummary.notRequired}</strong></div>
                </div>
                <div className="event-refund-bulk-actions">
                    <p>{selectedEvent.refundSummary.total === 0 ? "Event này không có đơn confirmed cần hoàn tiền." : `${selectedEvent.refundSummary.completed}/${selectedEvent.refundSummary.total - selectedEvent.refundSummary.notRequired} yêu cầu cần hoàn đã hoàn tất mô phỏng.`}</p>
                    {(selectedEvent.refundSummary.pending + selectedEvent.refundSummary.failed) > 0 && <button type="button" onClick={() => setBulkRefundTarget("processing")}><Clock3 size={15} /> Xử lý tất cả ({selectedEvent.refundSummary.pending + selectedEvent.refundSummary.failed})</button>}
                    {selectedEvent.refundSummary.processing > 0 && <button type="button" className="complete" onClick={() => setBulkRefundTarget("completed")}><Check size={15} /> Hoàn tất tất cả ({selectedEvent.refundSummary.processing})</button>}
                </div>
            </section>}

            <div className="events-list-panel">
                {loading ? <div className="events-empty"><p>Đang tải đơn hàng...</p></div> : orders.length === 0 ? (
                    <div className="events-empty"><PackageSearch size={38} /><h3>{status === "all" ? "Không tìm thấy đơn hàng" : `Không có đơn ${statusLabel(status).toLowerCase()}`}</h3><p>Hãy thay đổi bộ lọc trạng thái, sự kiện hoặc email người mua.</p></div>
                ) : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                    <caption className="sr-only">Danh sách đơn hàng</caption>
                    <thead><tr>{['Mã đơn', 'Người mua', 'Sự kiện', 'Tổng tiền', 'Trạng thái', 'Ngày tạo', 'Hành động'].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
                    <tbody>{orders.map(order => <tr key={order.id} className="border-t border-white/10">
                        <td className="p-3">{order.orderCode}</td>
                        <td className="p-3">{order.buyerName}<br />{order.buyerEmail}</td>
                        <td className="p-3">{order.eventName}</td>
                        <td className="p-3">{formatMoney(order.totalAmount)}</td>
                        <td className="p-3"><span className={`event-status ${orderStatusClass(order.status)}`}>{statusLabel(order.status)}</span></td>
                        <td className="p-3">{formatDate(order.createdAt)}</td>
                        <td className="p-3">
                            <div className="order-row-actions">
                                <button type="button" className="order-table-action" onClick={() => void openDetail(order.id)} aria-label={`Xem chi tiết đơn ${order.orderCode}`}>
                                    <Eye size={15} /><span>Chi tiết</span>
                                </button>
                                {order.eventStatus === "cancelled" && order.status === "confirmed" && order.refundStatus && order.refundStatus !== "not_required" && <button
                                    type="button"
                                    className="order-table-action refund"
                                    disabled={refundLoadingOrderId !== null}
                                    title={`Refund mô phỏng: ${statusLabel(order.refundStatus)}`}
                                    aria-label={`Xử lý hoàn tiền mô phỏng cho đơn ${order.orderCode}, trạng thái ${statusLabel(order.refundStatus)}`}
                                    onClick={() => void openRefund(order.id)}
                                >
                                    {refundLoadingOrderId === order.id ? <RefreshCcw className="order-action-spinner" size={15} /> : <CircleDollarSign size={15} />}
                                    <span>{refundLoadingOrderId === order.id ? "Đang tải" : `Refund · ${statusLabel(order.refundStatus)}`}</span>
                                </button>}
                            </div>
                        </td>
                    </tr>)}</tbody>
                </table></div>}

            </div>

            {!loading && total > 0 && pageCount > 1 && (
                <nav className="events-pagination" aria-label="Phân trang danh sách đơn hàng">
                    <button type="button" disabled={page <= 1 || paginationDisabled} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                        <ChevronLeft size={16} /> Trang trước
                    </button>
                    <span>Trang <strong>{page}</strong> / {pageCount}</span>
                    <button type="button" disabled={page >= pageCount || paginationDisabled} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
                        Trang sau <ChevronRight size={16} />
                    </button>
                </nav>
            )}

            {detailLoading && createPortal(
                <div className="events-dialog-backdrop order-dialog-backdrop" role="status" aria-live="polite">
                    <div className="events-dialog order-dialog-loading"><div className="events-empty"><RefreshCcw className="order-action-spinner" size={22} /><p>Đang tải chi tiết đơn hàng...</p></div></div>
                </div>,
                document.body,
            )}

            {detail && !detailLoading && createPortal(
                <div className="events-dialog-backdrop order-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && actionLoading === null) setDetail(null); }}>
                    <div ref={dialogRef} className="events-dialog order-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="order-dialog-title">
                        <header><div><span>QUẢN TRỊ / ĐƠN HÀNG / #{detail.id}</span><h3 id="order-dialog-title">Chi tiết {detail.orderCode}</h3></div><button type="button" disabled={actionLoading !== null} onClick={() => setDetail(null)} aria-label="Đóng chi tiết đơn hàng"><X size={20} /></button></header>
                        <form onSubmit={(event) => event.preventDefault()}>
                            {error && <div role="alert" className="events-form-errors"><p>{error}</p></div>}
                            {notice && <div role="status" className="events-rule-banner"><Mail size={18} /><div><strong>{notice}</strong></div></div>}
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
                            {detail.status === "confirmed" && detail.eventStatus === "cancelled" && <p className="text-sm text-muted-foreground">Event đã hủy: Order được giữ nguyên lịch sử; quy trình Refund mô phỏng được xử lý bằng nút riêng ngoài danh sách.</p>}
                            {detail.status === "confirmed" && detail.eventStatus !== "cancelled" && <p className="text-sm text-muted-foreground">Đơn đã mua thành công không được hủy hoặc Refund khi Event vẫn còn hiệu lực.</p>}

                            <footer>
                                <button type="button" disabled={actionLoading !== null} onClick={() => setDetail(null)}>Đóng</button>
                                <button type="button" disabled={detail.status !== "confirmed" || actionLoading !== null} onClick={() => void resendEmail()}><Send size={14} /> {actionLoading === "resend" ? "Đang xếp lịch..." : "Gửi lại email vé"}</button>
                                {detail.status === "pending_payment" && <button className="primary" type="button" disabled={actionLoading !== null} onClick={() => void cancelOrder()}><Ban size={14} /> {actionLoading === "cancel" ? "Đang hủy..." : "Hủy đơn"}</button>}
                            </footer>
                        </form>
                    </div>
                </div>,
                document.body,
            )}

            {bulkRefundTarget && selectedEvent?.status === "cancelled" && createPortal(
                <div className="events-dialog-backdrop order-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !bulkRefundLoading) setBulkRefundTarget(null); }}>
                    <div ref={bulkRefundDialogRef} className="events-dialog order-bulk-refund-dialog" role="alertdialog" aria-modal="true" aria-labelledby="bulk-refund-dialog-title" aria-describedby="bulk-refund-dialog-description">
                        <header><div><span>REFUND HÀNG LOẠT / EVENT #{selectedEvent.id}</span><h3 id="bulk-refund-dialog-title">{bulkRefundTarget === "processing" ? "Xử lý tất cả yêu cầu" : "Hoàn tất tất cả yêu cầu"}</h3></div><button type="button" disabled={bulkRefundLoading} onClick={() => setBulkRefundTarget(null)} aria-label="Đóng xác nhận Refund hàng loạt"><X size={20} /></button></header>
                        <form onSubmit={(event) => event.preventDefault()}>
                            <div className="refund-simulation-banner"><AlertTriangle size={19} /><div><strong>THAO TÁC HÀNG LOẠT — MÔ PHỎNG</strong><p id="bulk-refund-dialog-description">Chỉ cập nhật workflow nội bộ của Event đã hủy; không gửi lệnh tới ngân hàng hoặc cổng thanh toán.</p></div></div>
                            <section className="bulk-refund-confirm-card">
                                <span>Sự kiện đã hủy</span><h4>{selectedEvent.name}</h4>
                                <strong>{bulkRefundTarget === "processing" ? selectedEvent.refundSummary.pending + selectedEvent.refundSummary.failed : selectedEvent.refundSummary.processing}</strong>
                                <p>{bulkRefundTarget === "processing" ? "yêu cầu đang chờ/thất bại sẽ chuyển sang Đang xử lý" : "yêu cầu đang xử lý sẽ chuyển sang Hoàn tất mô phỏng"}</p>
                            </section>
                            <div className="bulk-refund-safety-note"><Check size={17} /><p>Order confirmed, Payment thành công, số tiền và danh tính Refund được giữ nguyên. Bạn có thể xử lý riêng từng đơn nếu cần ghi nhận lỗi.</p></div>
                            <footer>
                                <button type="button" disabled={bulkRefundLoading} onClick={() => setBulkRefundTarget(null)}>Quay lại</button>
                                <button type="button" className="primary" disabled={bulkRefundLoading} onClick={() => void transitionEventRefunds()}>{bulkRefundLoading ? <RefreshCcw className="order-action-spinner" size={15} /> : bulkRefundTarget === "processing" ? <Clock3 size={15} /> : <Check size={15} />}{bulkRefundLoading ? "Đang cập nhật..." : "Xác nhận thao tác hàng loạt"}</button>
                            </footer>
                        </form>
                    </div>
                </div>,
                document.body,
            )}

            {refundDetail && createPortal(
                <div className="events-dialog-backdrop order-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && actionLoading !== "refund") setRefundDetail(null); }}>
                    <div ref={refundDialogRef} className="events-dialog order-refund-dialog" role="dialog" aria-modal="true" aria-labelledby="refund-dialog-title" aria-describedby="refund-simulation-note">
                        <header>
                            <div><span>ĐƠN HÀNG / {refundDetail.orderCode}</span><h3 id="refund-dialog-title">Xử lý Refund mô phỏng</h3></div>
                            <button type="button" disabled={actionLoading === "refund"} onClick={() => setRefundDetail(null)} aria-label="Đóng quy trình hoàn tiền"><X size={20} /></button>
                        </header>
                        <form onSubmit={(event) => event.preventDefault()}>
                            <div id="refund-simulation-note" className="refund-simulation-banner">
                                <AlertTriangle size={19} />
                                <div><strong>MÔ PHỎNG PHỤC VỤ ĐỒ ÁN</strong><p>Không gọi ngân hàng hoặc cổng thanh toán và không xác nhận khách đã nhận tiền thật.</p></div>
                            </div>

                            {refundError && <div role="alert" className="events-form-errors"><p>{refundError}</p></div>}
                            {refundNotice && <div role="status" className="refund-success-banner"><Check size={18} /><strong>{refundNotice}</strong></div>}

                            <section className="refund-order-summary" aria-label="Thông tin đơn hàng">
                                <div><span>Khách hàng</span><strong>{refundDetail.buyerName}</strong><small>{refundDetail.buyerEmail}</small></div>
                                <div><span>Sự kiện</span><strong>{refundDetail.eventName}</strong><small>Đơn {statusLabel(refundDetail.status).toLowerCase()}</small></div>
                                <div><span>Tổng đơn</span><strong>{formatMoney(refundDetail.totalAmount)}</strong><small>{refundDetail.totalQuantity} vé</small></div>
                            </section>

                            {!refundDetail.refund ? (
                                <section className="refund-empty-state">
                                    <CircleDollarSign size={34} />
                                    <div><h4>Chưa phát sinh yêu cầu Refund</h4><p>Yêu cầu hoàn tiền chỉ được hệ thống tạo khi Admin hủy một Event đã có đơn xác nhận. Không thể tạo thủ công tại trang Đơn hàng để tránh sai lệch lịch sử giao dịch.</p></div>
                                </section>
                            ) : (
                                <>
                                    <section className="refund-record-card" aria-label="Yêu cầu hoàn tiền mô phỏng">
                                        <div className="refund-record-heading">
                                            <div><span>Số tiền mô phỏng</span><strong>{formatMoney(refundDetail.refund.amount)}</strong></div>
                                            <span className={`event-status ${refundStatusClass(refundDetail.refund.status)}`}>{statusLabel(refundDetail.refund.status)}</span>
                                        </div>
                                        <dl>
                                            <div><dt>Lý do</dt><dd>{refundDetail.refund.reason}</dd></div>
                                            <div><dt>Ghi nhận</dt><dd>{formatDate(refundDetail.refund.requestedAt)}</dd></div>
                                            {refundDetail.refund.completedAt && <div><dt>Hoàn tất mô phỏng</dt><dd>{formatDate(refundDetail.refund.completedAt)}</dd></div>}
                                            {refundDetail.refund.failureReason && <div className="refund-failure-row"><dt>Lỗi gần nhất</dt><dd>{refundDetail.refund.failureReason}</dd></div>}
                                        </dl>
                                    </section>

                                    <ol className="refund-progress" aria-label="Tiến trình hoàn tiền mô phỏng">
                                        <li className={refundStepClass(refundDetail.refund.status, "pending")} aria-current={refundDetail.refund.status === "pending" ? "step" : undefined}><span><Check size={14} /></span><div><strong>Đã ghi nhận</strong><small>Hệ thống tạo yêu cầu</small></div></li>
                                        <li className={refundStepClass(refundDetail.refund.status, "processing")} aria-current={refundDetail.refund.status === "processing" ? "step" : undefined}><span><Clock3 size={14} /></span><div><strong>Đang xử lý</strong><small>Admin xác nhận mô phỏng</small></div></li>
                                        <li className={refundStepClass(refundDetail.refund.status, "result")} aria-current={["completed", "failed"].includes(refundDetail.refund.status) ? "step" : undefined}><span>{refundDetail.refund.status === "failed" ? <X size={14} /> : <Check size={14} />}</span><div><strong>{refundDetail.refund.status === "failed" ? "Thất bại" : "Hoàn tất"}</strong><small>Kết quả được lưu audit</small></div></li>
                                    </ol>

                                    {refundDetail.refund.status === "pending" && <section className="refund-action-panel">
                                        <div><h4>Bắt đầu xử lý</h4><p>Chuyển yêu cầu sang trạng thái đang xử lý. Thao tác chỉ cập nhật quy trình nội bộ mô phỏng.</p></div>
                                        <button type="button" className="refund-primary-action" disabled={actionLoading !== null} onClick={() => void transitionRefund("processing")}><Clock3 size={16} />{actionLoading === "refund" ? "Đang cập nhật..." : "Bắt đầu xử lý"}</button>
                                    </section>}

                                    {refundDetail.refund.status === "processing" && <section className="refund-processing-panel">
                                        <div className="refund-complete-action"><div><h4>Xác nhận kết quả mô phỏng</h4><p>Chọn Hoàn tất nếu kịch bản xử lý thành công.</p></div><button type="button" className="refund-primary-action" disabled={actionLoading !== null} onClick={() => void transitionRefund("completed")}><Check size={16} />{actionLoading === "refund" ? "Đang cập nhật..." : "Hoàn tất mô phỏng"}</button></div>
                                        <div className="refund-failure-action"><label htmlFor="refund-failure-reason">Hoặc ghi nhận xử lý thất bại</label><textarea id="refund-failure-reason" minLength={5} maxLength={500} disabled={actionLoading !== null} value={refundFailureReason} onChange={event => setRefundFailureReason(event.target.value)} placeholder="Nhập lý do cụ thể, ít nhất 5 ký tự" /><div><small>{refundFailureReason.trim().length}/5 ký tự tối thiểu</small><button type="button" className="refund-danger-action" disabled={actionLoading !== null || refundFailureReason.trim().length < 5} onClick={() => void transitionRefund("failed")}><X size={16} />Đánh dấu thất bại</button></div></div>
                                    </section>}

                                    {refundDetail.refund.status === "failed" && <section className="refund-action-panel is-failed">
                                        <div><h4>Có thể thử lại</h4><p>Lỗi trước đó được giữ trong lịch sử; thao tác này đưa yêu cầu về trạng thái đang xử lý.</p></div>
                                        <button type="button" className="refund-primary-action" disabled={actionLoading !== null} onClick={() => void transitionRefund("processing")}><RefreshCcw size={16} />{actionLoading === "refund" ? "Đang cập nhật..." : "Thử lại xử lý"}</button>
                                    </section>}

                                    {refundDetail.refund.status === "completed" && <section className="refund-completed-state"><Check size={20} /><div><h4>Đã hoàn tất quy trình mô phỏng</h4><p>Bản ghi chỉ xác nhận kết quả nội bộ của đồ án. Thanh toán thành công ban đầu và trạng thái đơn được giữ nguyên để phục vụ kiểm toán.</p></div></section>}
                                </>
                            )}

                            <footer><button type="button" disabled={actionLoading === "refund"} onClick={() => setRefundDetail(null)}>Đóng</button></footer>
                        </form>
                    </div>
                </div>,
                document.body,
            )}
        </section>
    );
}