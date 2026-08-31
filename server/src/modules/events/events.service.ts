import { AppError } from '../../utils/app-error.js';
import {
    findEventById,
    findPublishedEvents,
    findTicketTypesByEventId,
} from './events.repository.js';
import type { ListEventsQuery } from './events.schema.js';

function mapEventSummary(row: Awaited<ReturnType<typeof findPublishedEvents>>['rows'][number]) {
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
        status: row.status,
        minPrice: row.min_price !== null ? Number(row.min_price) : 0,
        hasAvailable: Boolean(row.has_available),
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
    const mappedTicketTypes = ticketTypes.map((t) => {
        const available = Math.max(0, t.capacity - t.reserved_quantity - t.sold_quantity);
        const salesStartAt = t.sales_start_at ?? event.sales_start_at;
        const salesEndAt = t.sales_end_at ?? event.sales_end_at;
        const start = salesStartAt?.getTime() ?? null;
        const end = salesEndAt?.getTime() ?? null;
        const saleStatus = start !== null && now < start
            ? 'coming-soon'
            : end !== null && now > end
                ? 'closed'
                : available <= 0
                    ? 'sold-out'
                    : 'on-sale';
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
        status: event.status,
        saleStatus: eventSaleStatus,
        ticketTypes: mappedTicketTypes,
    };
}
