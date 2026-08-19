import type { Event, CategorySlug, EventLifecycleStatus } from "@/types/event.types";
import { computeAvailable, computeSaleStatus, computeSaleStatusFromWindow, computeMinPrice, computeTotalCapacity } from "@/constants/eventconstants";
import { formatDisplayDate, formatTimeLabel } from "@/lib/utils";
import { apiGet } from "./api";

// ---- Kiểu dữ liệu THÔ trả về từ BE (khớp mapEventSummary / getEventDetail) ----
interface ApiEventSummary {
    id: number;
    name: string;
    slug: string;
    category: CategorySlug;
    venue: string;
    address: string;
    city: string;
    coverImageUrl: string | null;
    startTime: string;
    endTime: string;
    salesStartAt: string | null;
    salesEndAt: string | null;
    status: EventLifecycleStatus;
    minPrice: number;
    hasAvailable: boolean;
}

interface ApiTicketType {
    id: number;
    name: string;
    description: string | null;
    price: number;
    capacity: number;
    reservedQuantity: number;
    soldQuantity: number;
    available: number;
    maxPerOrder: number;
    salesStartAt: string | null;
    salesEndAt: string | null;
    isActive: boolean;
}

interface ApiEventDetail {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    category: CategorySlug;
    venue: string;
    address: string;
    city: string;
    coverImageUrl: string | null;
    startTime: string;
    endTime: string;
    salesStartAt: string | null;
    salesEndAt: string | null;
    checkinStartAt: string | null;
    checkinEndAt: string | null;
    status: EventLifecycleStatus;
    ticketTypes: ApiTicketType[];
}

// ---- Mapping: API DTO -> Event (type FE đang dùng khắp component) ----

function mapSummaryToEvent(row: ApiEventSummary): Event {
    const fallbackImage = row.coverImageUrl ?? "";
    const tickets = [] as Event["tickets"]; // list view không cần chi tiết vé

    return {
        id: String(row.id),
        name: row.name,
        slug: row.slug,
        shortTitle: row.name,
        category: row.category,
        description: "",
        shortDesc: "",
        venue: row.venue,
        address: row.address,
        city: row.city,
        coverImage: fallbackImage,
        image: fallbackImage,
        startTime: row.startTime,
        endTime: row.endTime,
        displayDate: formatDisplayDate(row.startTime, row.endTime),
        time: formatTimeLabel(row.startTime),
        endTimeLabel: formatTimeLabel(row.endTime),
        salesStartAt: row.salesStartAt,
        salesEndAt: row.salesEndAt,
        checkinStartAt: null,
        checkinEndAt: null,
        status: row.status,
        saleStatus: computeSaleStatusFromWindow(
            { status: row.status, salesStartAt: row.salesStartAt, salesEndAt: row.salesEndAt },
            row.hasAvailable
        ),
        tickets,
        minPrice: row.minPrice,
        totalCapacity: 0,
    };
}

function mapDetailToEvent(row: ApiEventDetail): Event {
    const tickets = row.ticketTypes.map((t) => ({
        id: String(t.id),
        name: t.name,
        description: t.description ?? "",
        price: t.price,
        capacity: t.capacity,
        reservedQuantity: t.reservedQuantity,
        soldQuantity: t.soldQuantity,
        available: t.available ?? computeAvailable(t),
        maxPerOrder: t.maxPerOrder,
        salesStartAt: t.salesStartAt,
        salesEndAt: t.salesEndAt,
        isActive: t.isActive,
    }));

    const fallbackImage = row.coverImageUrl ?? "";

    return {
        id: String(row.id),
        name: row.name,
        slug: row.slug,
        shortTitle: row.name,
        category: row.category,
        description: row.description ?? "",
        shortDesc: (row.description ?? "").slice(0, 140),
        venue: row.venue,
        address: row.address,
        city: row.city,
        coverImage: fallbackImage,
        image: fallbackImage,
        startTime: row.startTime,
        endTime: row.endTime,
        displayDate: formatDisplayDate(row.startTime, row.endTime),
        time: formatTimeLabel(row.startTime),
        endTimeLabel: formatTimeLabel(row.endTime),
        salesStartAt: row.salesStartAt,
        salesEndAt: row.salesEndAt,
        checkinStartAt: row.checkinStartAt,
        checkinEndAt: row.checkinEndAt,
        status: row.status,
        saleStatus: computeSaleStatus({ status: row.status, salesStartAt: row.salesStartAt, salesEndAt: row.salesEndAt, tickets }),
        tickets,
        minPrice: computeMinPrice(tickets),
        totalCapacity: computeTotalCapacity(tickets),
    };
}

// ---- API công khai mà các page/component gọi ----

export interface EventListParams {
    q?: string;
    category?: CategorySlug;
    city?: string;
    page?: number;
    limit?: number;
    sort?: "upcoming" | "newest" | "price-asc" | "price-desc";
}

export async function fetchEventList(params: EventListParams = {}): Promise<{ events: Event[]; total: number }> {
    const { data, meta } = await apiGet<ApiEventSummary[]>("/events", {
        q: params.q,
        category: params.category,
        city: params.city,
        page: params.page,
        limit: params.limit,
        sort: params.sort,
    });
    return { events: data.map(mapSummaryToEvent), total: meta?.total ?? data.length };
}

export async function fetchEventById(id: string): Promise<Event | null> {
    try {
        const { data } = await apiGet<ApiEventDetail>(`/events/${id}`);
        return mapDetailToEvent(data);
    } catch {
        return null;
    }
}