// Slug khớp đúng với events.category ENUM trong DB
export type CategorySlug = "music" | "conference" | "food" | "sports" | "art";

// Khớp đúng events.status ENUM trong DB (trạng thái quản trị)
export type EventLifecycleStatus = "draft" | "published" | "ended" | "cancelled";

// Trạng thái BÁN VÉ — không lưu trong DB, luôn được TÍNH ra từ
// status + sales_start_at/sales_end_at + tồn kho vé
export type TicketSaleStatus = "on-sale" | "sold-out" | "coming-soon" | "closed";

export interface TicketType {
  id: string;
  name: string;
  description: string;
  price: number;
  capacity: number;
  reservedQuantity: number;
  soldQuantity: number;
  /** = capacity - reservedQuantity - soldQuantity, KHÔNG lưu trực tiếp trong DB */
  available: number;
  maxPerOrder: number;
  salesStartAt: string | null;
  salesEndAt: string | null;
  isActive: boolean;
}



export interface Event {
  id: string;
  name: string;          // events.name
  slug: string;          // events.slug
  shortTitle: string;    // FE-only, để hiển thị card gọn — KHÔNG có cột riêng trong DB
  category: CategorySlug;
  description: string;
  shortDesc?: string;    // FE-derived (cắt ngắn description), không có cột riêng

  venue: string;
  address: string;
  city: string;

  coverImage: string;    // events.cover_image_url
  image?: string;        // dùng chung coverImage nếu chưa có cột thumbnail_url riêng

  startTime: string;     // events.start_time (ISO)
  endTime: string;       // events.end_time (ISO)
  displayDate: string;   // FE-derived, format từ startTime, không lưu DB
  time: string;          // FE-derived "HH:mm"
  endTimeLabel: string;  // FE-derived "HH:mm"

  salesStartAt: string | null;
  salesEndAt: string | null;
  checkinStartAt: string | null;
  checkinEndAt: string | null;

  status: EventLifecycleStatus;   // raw từ DB
  saleStatus: TicketSaleStatus;   // TÍNH ra, dùng để hiển thị badge/nút mua vé

  tickets: TicketType[];
  minPrice: number;       // TÍNH: MIN(tickets[].price)
  totalCapacity: number;  // TÍNH: SUM(tickets[].capacity)
}

export type SortKey = "newest" | "upcoming" | "price-asc" | "price-desc";

export interface SelectOption {
  value: string;
  label: string;
}