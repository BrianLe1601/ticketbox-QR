export interface OrderItem {
    ticketTypeId: number;
    ticketTypeName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
}

export type OrderStatus = "pending_payment" | "confirmed" | "expired" | "cancelled";

export interface Order {
    id: number;
    orderCode: string;
    eventId: number;
    buyerName: string;
    buyerEmail: string;
    buyerPhone: string | null;
    status: OrderStatus;
    totalQuantity: number;
    subtotalAmount: number;
    discountAmount: number;
    totalAmount: number;
    expiresAt: string | null;
    confirmedAt: string | null;
    expiredAt: string | null;
    cancelledAt: string | null;
    createdAt: string;
    items: OrderItem[];
}

export interface CreateOrderResult extends Order {
    lookupToken: string;
}

export interface BuyerInfo {
    name: string;
    email: string;
    phone?: string;
}

export interface TicketSelection {
    ticketTypeId: string;
    quantity: number;
}

export interface IssuedTicket {
    ticketCode: string;
    ticketTypeName: string;
    qrDataUrl: string;
}

export interface PaymentResult {
    orderId: number;
    orderCode: string;
    status: "confirmed";
    buyerEmail: string;
    emailSent: boolean;
    emailMessage: string;
    tickets: IssuedTicket[];
}
