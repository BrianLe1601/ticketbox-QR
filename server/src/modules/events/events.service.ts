import { AppError } from '../../utils/app-error.js';
import {
    findEventById,
    findPublishedEvents,
    findTicketTypesByEventId,
    findPublicEventStats,
} from './events.repository.js';
import type { ListEventsQuery } from './events.schema.js';
import { deriveEventLifecycleStatus } from './event-lifecycle.service.js';
import { deriveTicketSaleStatus, effectiveTicketSalesWindow } from './event-sales.js';

export async function getPublicEventStats() {
    const row = await findPublicEventStats();
    const denominator = Number(row.eligible_tickets);
    return {
        eventsThisYear: Number(row.events_this_year),
        buyers: Number(row.buyers),
        checkinRate: denominator === 0 ? null : Math.round(Number(row.checked_in) / denominator * 1000) / 10,
    };
}

function mapEventSummary(row: Awaited<ReturnType<typeof findPublishedEvents>>['rows'][number]) {
    const status = deriveEventLifecycleStatus({
        status: row.status,
        startTime: row.start_time,
        endTime: row.end_time,
    });
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        category: row.category,
        venue: row.venue,
        address: row.address,
        city: row.city,
        coverImageUrl: row.cover_image_url,
        startTime: row.start_time,
        endTime: row.end_time,
        salesStartAt: row.sales_start_at,
        salesEndAt: row.sales_end_at,
        status,
        minPrice: row.min_price !== null ? Number(row.min_price) : 0,
        hasAvailable: Boolean(row.has_available),
        soldCount: Number(row.sold_count),
        saleStatus: row.sale_status,
    };
}

export async function getEventList(query: ListEventsQuery) {
    const { rows, total } = await findPublishedEvents(query);
    return {
        items: rows.map(mapEventSummary),
        meta: { total, page: query.page, limit: query.limit },
    };
}

export async function getEventDetail(id: number) {
    const event = await findEventById(id);
    if (!event) {
        throw AppError.notFound('Sự kiện không tồn tại hoặc chưa được công bố');
    }

    const ticketTypes = await findTicketTypesByEventId(id);
    const now = Date.now();
    const status = deriveEventLifecycleStatus({
        status: event.status,
        startTime: event.start_time,
        endTime: event.end_time,
    }, new Date(now));
    const eventClosed = status === 'completed' || status === 'cancelled' || event.end_time.getTime() <= now;
    const mappedTicketTypes = ticketTypes.map((t) => {
        const available = Math.max(0, t.capacity - t.reserved_quantity - t.sold_quantity);
        const { startAt: salesStartAt, endAt: salesEndAt } = effectiveTicketSalesWindow(
            event.sales_start_at,
            event.sales_end_at,
            t.sales_start_at,
            t.sales_end_at,
        );
        const saleStatus = deriveTicketSaleStatus({
            eventStatus: status,
            eventEndAt: event.end_time,
            eventSalesStartAt: event.sales_start_at,
            eventSalesEndAt: event.sales_end_at,
            ticketSalesStartAt: t.sales_start_at,
            ticketSalesEndAt: t.sales_end_at,
            available,
            now: new Date(now),
        });
        return {id:t.id,name:t.name,description:t.description,price:Number(t.price),capacity:t.capacity,reservedQuantity:t.reserved_quantity,soldQuantity:t.sold_quantity,available,maxPerOrder:t.max_per_order,salesStartAt,salesEndAt,saleStatus,isActive:Boolean(t.is_active)};
    });
    const eventSaleStatus = mappedTicketTypes.some((ticket)=>ticket.saleStatus==='on-sale')
        ? 'on-sale'
        : mappedTicketTypes.some((ticket)=>ticket.saleStatus==='coming-soon')
            ? 'coming-soon'
            : mappedTicketTypes.length>0&&mappedTicketTypes.every((ticket)=>ticket.saleStatus==='sold-out')
                ? 'sold-out'
                : 'closed';

    return {
        id: event.id,
        name: event.name,
        slug: event.slug,
        description: event.description,
        category: event.category,
        venue: event.venue,
        address: event.address,
        city: event.city,
        coverImageUrl: event.cover_image_url,
        startTime: event.start_time,
        endTime: event.end_time,
        salesStartAt: event.sales_start_at,
        salesEndAt: event.sales_end_at,
        checkinStartAt: event.checkin_start_at,
        checkinEndAt: event.checkin_end_at,
        status,
        saleStatus: eventClosed ? 'closed' : eventSaleStatus,
        ticketTypes: mappedTicketTypes,
    };
}
