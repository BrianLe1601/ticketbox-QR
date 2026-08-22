import type { CreateOrderResult, Order, BuyerInfo, TicketSelection, PaymentResult } from "@/types/order.types";
import { apiGet, apiPost } from "./api";

export interface CreateOrderPayload {
    eventId: string;
    items: TicketSelection[];
    buyer: BuyerInfo;
}

export async function createOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
    const { data } = await apiPost<CreateOrderResult>("/checkout/orders", {
        eventId: payload.eventId,
        items: payload.items.map((i) => ({ ticketTypeId: i.ticketTypeId, quantity: i.quantity })),
        buyer: payload.buyer,
    });
    return data;
}

export async function fetchOrder(orderId: string, token: string): Promise<Order | null> {
    try {
        const { data } = await apiGet<Order>(`/checkout/orders/${orderId}`, { token });
        return data;
    } catch {
        return null;
    }
}

export async function payOrder(orderId: number, token: string): Promise<PaymentResult> {
    const { data } = await apiPost<PaymentResult>(`/checkout/orders/${orderId}/pay`, { token });
    return data;
}
