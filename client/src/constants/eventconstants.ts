import type { CategorySlug, Event, TicketType, TicketSaleStatus, SortKey, SelectOption } from "@/types/event.types";

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
    music: "Âm nhạc",
    conference: "Hội nghị",
    food: "Ẩm thực",
    sports: "Thể thao",
    art: "Nghệ thuật",
};

export const CATEGORY_SLUGS: CategorySlug[] = ["music", "conference", "food", "sports", "art"];

export function getCategoryLabel(slug: CategorySlug): string {
    return CATEGORY_LABELS[slug] ?? slug;
}

export const CITY_LABELS: Record<string, string> = {
    hcm: "TP. Hồ Chí Minh",
    hn: "Hà Nội",
    dn: "Đà Nẵng",
};

/** available = capacity - reservedQuantity - soldQuantity, đúng như view v_ticket_type_inventory */
export function computeAvailable(t: Pick<TicketType, "capacity" | "reservedQuantity" | "soldQuantity">): number {
    return Math.max(0, t.capacity - t.reservedQuantity - t.soldQuantity);
}

/**
 * Suy ra trạng thái bán vé hiển thị cho FE.
 * Không lưu trong DB — luôn tính lại từ status + sales window + tồn kho.
 * Dùng khi đã có đầy đủ dữ liệu vé thật (trang chi tiết).
 */
export function computeSaleStatus(event: Pick<Event, "status" | "salesStartAt" | "salesEndAt" | "tickets">): TicketSaleStatus {
    if (event.status !== "published") return "closed";

    const now = Date.now();
    const start = event.salesStartAt ? new Date(event.salesStartAt).getTime() : null;
    const end = event.salesEndAt ? new Date(event.salesEndAt).getTime() : null;

    if (start && now < start) return "coming-soon";
    if (end && now > end) return "closed";

    const totalAvailable = event.tickets.reduce((sum, t) => sum + t.available, 0);
    if (totalAvailable <= 0) return "sold-out";

    return "on-sale";
}

/**
 * Biến thể cho list view: API summary (/events) không trả chi tiết từng loại vé,
 * nhưng có kèm cờ tổng hợp `hasAvailable` (còn ít nhất 1 loại vé active có tồn kho).
 * Dùng cờ đó thay vì `tickets` rỗng để không bị suy diễn sai thành "sold-out".
 */
export function computeSaleStatusFromWindow(
    event: Pick<Event, "status" | "salesStartAt" | "salesEndAt">,
    hasAvailable: boolean
): TicketSaleStatus {
    if (event.status !== "published") return "closed";

    const now = Date.now();
    const start = event.salesStartAt ? new Date(event.salesStartAt).getTime() : null;
    const end = event.salesEndAt ? new Date(event.salesEndAt).getTime() : null;

    if (start && now < start) return "coming-soon";
    if (end && now > end) return "closed";
    if (!hasAvailable) return "sold-out";

    return "on-sale";
}

export function computeMinPrice(tickets: TicketType[]): number {
    const active = tickets.filter((t) => t.isActive);
    if (active.length === 0) return 0;
    return Math.min(...active.map((t) => t.price));
}

export function computeTotalCapacity(tickets: TicketType[]): number {
    return tickets.reduce((sum, t) => sum + t.capacity, 0);
}

export type CategoryFilter = "all" | CategorySlug;

export const CATEGORY_FILTER_OPTIONS: { value: CategoryFilter; label: string }[] = [
    { value: "all", label: "Tất cả" },
    ...CATEGORY_SLUGS.map((slug) => ({ value: slug as CategoryFilter, label: CATEGORY_LABELS[slug] })),
];

export const CITY_OPTIONS: SelectOption[] = [
    { value: "all", label: "Tất cả thành phố" },
    ...Object.entries(CITY_LABELS).map(([value, label]) => ({ value, label })),
];

export const TIME_OPTIONS: SelectOption[] = [
    { value: "all", label: "Tất cả thời gian" },
    { value: "week", label: "Tuần này (7 ngày)" },
    { value: "month", label: "Tháng này (30 ngày)" },
];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: "upcoming", label: "Sắp diễn ra" },
    { value: "newest", label: "Mới thêm" },
    { value: "price-asc", label: "Giá tăng dần" },
    { value: "price-desc", label: "Giá giảm dần" },
];

export const PAGE_SIZE = 3;