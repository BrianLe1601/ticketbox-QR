import type { CreateOrderResult, Order, BuyerInfo, TicketSelection, PaymentResult } from "@/types/order.types";
import { apiGet, apiPost } from "./api";

export interface CreateOrderPayload {
    eventId: string;
    emailVerificationToken: string;
    items: TicketSelection[];
    buyer: BuyerInfo;
}

export async function createOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
    const { data } = await apiPost<CreateOrderResult>("/checkout/orders", {
        eventId: payload.eventId,
        emailVerificationToken: payload.emailVerificationToken,
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

export async function requestEmailVerification(email: string) {
    const { data } = await apiPost<{ message: string; expiresInSeconds: number }>("/checkout/email-verifications", { email });
    return data;
}

export async function confirmEmailVerification(email: string, code: string) {
    const { data } = await apiPost<{ verificationToken: string; email: string }>("/checkout/email-verifications/confirm", { email, code });
    return data;
}

export async function payOrder(orderId: number, token: string): Promise<PaymentResult> {
    const { data } = await apiPost<PaymentResult>(`/checkout/orders/${orderId}/pay`, { token });
    return data;
}
