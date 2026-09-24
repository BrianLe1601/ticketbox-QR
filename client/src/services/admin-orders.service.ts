import { apiRequest } from "@/services/api";
import { getStoredToken } from "@/services/auth.service";

export type AdminOrderStatus = "pending_payment" | "confirmed" | "expired" | "cancelled";
export type TicketRowStatus = "issued" | "checked_in" | "cancelled";
export type PaymentRowStatus = "pending" | "success" | "failed" | "cancelled";
export type EmailLogStatus = "pending" | "processing" | "sent" | "failed";

export interface AdminOrderListItem {
    id: number;
    orderCode: string;
    eventId: number;
    eventName: string;
    buyerName: string;
    buyerEmail: string;
    totalQuantity: number;
    totalAmount: number;
    status: AdminOrderStatus;
    createdAt: string;
    expiresAt: string | null;
    confirmedAt: string | null;
}

export interface AdminOrderItem {
    id: number;
    ticketTypeId: number;
    ticketTypeName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
}

export interface AdminOrderTicket {
    id: number;
    orderItemId: number;
    ticketCode: string;
    holderName: string | null;
    holderEmail: string | null;
    status: TicketRowStatus;
    issuedAt: string;
    checkedInAt: string | null;
    cancelledAt: string | null;
}

export interface AdminOrderPayment {
    id: number;
    paymentCode: string;
    method: "free" | "simulated";
    amount: number;
    status: PaymentRowStatus;
    failureReason: string | null;
    paidAt: string | null;
    createdAt: string;
}

export interface AdminOrderEmailLog {
    id: number;
    recipient: string;
    emailType: "ticket_issued" | "ticket_resent" | "order_cancelled";
    status: EmailLogStatus;
    errorMessage: string | null;
    attemptCount: number;
    nextAttemptAt: string | null;
    sentAt: string | null;
    createdAt: string;
}

export interface AdminOrderDetail {
    id: number;
    orderCode: string;
    eventId: number;
    eventName: string;
    buyerName: string;
    buyerEmail: string;
    buyerPhone: string | null;
    totalQuantity: number;
    subtotalAmount: number;
    discountAmount: number;
    totalAmount: number;
    status: AdminOrderStatus;
    expiresAt: string | null;
    confirmedAt: string | null;
    expiredAt: string | null;
    cancelledAt: string | null;
    createdAt: string;
    items: AdminOrderItem[];
    tickets: AdminOrderTicket[];
    payments: AdminOrderPayment[];
    emailLogs: AdminOrderEmailLog[];
}

export interface ResendEmailResult {
    orderId: number;
    jobId: number;
    queued: true;
    status: "pending" | "processing";
    message: string;
}

export interface ListOrdersFilters {
    status?: AdminOrderStatus;
    eventId?: number;
    buyerEmail?: string;
    page?: number;
    limit?: number;
}

const auth = () => getStoredToken();

function buildQuery(filters: ListOrdersFilters): string {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.eventId) params.set("eventId", String(filters.eventId));
    if (filters.buyerEmail) params.set("buyerEmail", filters.buyerEmail);
    params.set("page", String(filters.page ?? 1));
    params.set("limit", String(filters.limit ?? 20));
    return params.toString();
}

export async function listAdminOrders(filters: ListOrdersFilters = {}) {
    return apiRequest<AdminOrderListItem[]>(`/admin/orders?${buildQuery(filters)}`, {}, auth());
}

export async function getAdminOrder(id: number) {
    return (await apiRequest<AdminOrderDetail>(`/admin/orders/${id}`, {}, auth())).data;
}

export async function cancelAdminOrder(id: number, reason?: string) {
    return (await apiRequest<AdminOrderDetail>(`/admin/orders/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
    }, auth())).data;
}

export async function resendAdminOrderEmail(id: number) {
    return (await apiRequest<ResendEmailResult>(`/admin/orders/${id}/resend-email`, {
        method: "POST",
    }, auth())).data;
}
export interface OrderStats { pending: number; paidToday: number; expired: number }
export async function getAdminOrderStats() {
    return (await apiRequest<OrderStats>('/admin/orders/stats', {}, getStoredToken())).data;
}

export async function retryAdminOrderEmail(id: number, logId: number) {
    return (await apiRequest<ResendEmailResult>(`/admin/orders/${id}/email-logs/${logId}/retry`, { method: "POST" }, auth())).data;
}
