export type EventLifecycleStatus = 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
export type TicketSaleStatus = 'on-sale' | 'coming-soon' | 'sold-out' | 'closed';

function latest(left: Date | null, right: Date | null) {
    if (!left) return right;
    if (!right) return left;
    return left.getTime() >= right.getTime() ? left : right;
}

function earliest(left: Date | null, right: Date | null) {
    if (!left) return right;
    if (!right) return left;
    return left.getTime() <= right.getTime() ? left : right;
}

/** A Ticket Type may narrow an Event sales window, but never extend it. */
export function effectiveTicketSalesWindow(
    eventSalesStartAt: Date | null,
    eventSalesEndAt: Date | null,
    ticketSalesStartAt: Date | null,
    ticketSalesEndAt: Date | null,
) {
    return {
        startAt: latest(eventSalesStartAt, ticketSalesStartAt),
        endAt: earliest(eventSalesEndAt, ticketSalesEndAt),
    };
}

export function deriveTicketSaleStatus(input: {
    eventStatus: EventLifecycleStatus;
    eventEndAt: Date;
    eventSalesStartAt: Date | null;
    eventSalesEndAt: Date | null;
    ticketSalesStartAt: Date | null;
    ticketSalesEndAt: Date | null;
    available: number;
    now?: Date;
}): TicketSaleStatus {
    const now = input.now ?? new Date();
    if (!['published', 'ongoing'].includes(input.eventStatus) || input.eventEndAt.getTime() <= now.getTime()) return 'closed';

    const { startAt, endAt } = effectiveTicketSalesWindow(
        input.eventSalesStartAt,
        input.eventSalesEndAt,
        input.ticketSalesStartAt,
        input.ticketSalesEndAt,
    );
    if (startAt && endAt && startAt.getTime() > endAt.getTime()) return 'closed';
    if (input.available <= 0) return 'sold-out';
    if (endAt && now.getTime() > endAt.getTime()) return 'closed';
    if (startAt && now.getTime() < startAt.getTime()) return 'coming-soon';
    return 'on-sale';
}

export function isEventAvailableForTicketDelivery(
    status: EventLifecycleStatus,
    endAt: Date,
    now = new Date(),
) {
    return ['published', 'ongoing'].includes(status) && endAt.getTime() > now.getTime();
}
