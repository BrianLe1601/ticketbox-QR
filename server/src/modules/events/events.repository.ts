import { pool } from '../../database/pool.js';
import type { RowDataPacket } from 'mysql2';
import type { ListEventsQuery } from './events.schema.ts';

export interface EventRow extends RowDataPacket {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    category: 'music' | 'conference' | 'food' | 'sports' | 'art';
    venue: string;
    address: string;
    city: string;
    cover_image_url: string | null;
    start_time: Date;
    end_time: Date;
    sales_start_at: Date | null;
    sales_end_at: Date | null;
    checkin_start_at: Date | null;
    checkin_end_at: Date | null;
    status: 'draft' | 'published' | 'ended' | 'cancelled';
    min_price: number | null;
    has_available: number;
    sale_status: 'on-sale' | 'coming-soon' | 'sold-out' | 'closed';
}

export interface TicketTypeRow extends RowDataPacket {
    id: number;
    event_id: number;
    name: string;
    description: string | null;
    price: string; // DECIMAL trả về dạng string từ mysql2
    capacity: number;
    reserved_quantity: number;
    sold_quantity: number;
    max_per_order: number;
    sales_start_at: Date | null;
    sales_end_at: Date | null;
    is_active: number;
}

const EVENT_SELECT = `
    e.id, e.name, e.slug, e.description, e.category,
    e.venue, e.address, e.city,
    e.cover_image_url, e.start_time, e.end_time,
    e.sales_start_at, e.sales_end_at,
    e.checkin_start_at, e.checkin_end_at, e.status
`;

export async function findPublishedEvents(query: ListEventsQuery) {
    const { q, category, city, page, limit } = query;
    const offset = (page - 1) * limit;

    const conditions: string[] = [`e.status IN ('published','ongoing')`, `e.visibility = 'visible'`];
    const params: unknown[] = [];

    if (q) {
        conditions.push(`(e.name LIKE ? OR e.venue LIKE ? OR e.address LIKE ?)`);
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (category) {
        conditions.push(`e.category = ?`);
        params.push(category);
    }
    if (city) {
        conditions.push(`e.city = ?`);
        params.push(city);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const orderBy =
        query.sort === 'newest' ? 'e.created_at DESC'
            : query.sort === 'price-asc' ? 'min_price ASC'
                : query.sort === 'price-desc' ? 'min_price DESC'
                    : 'e.start_time ASC'; // upcoming

    // has_available: còn ít nhất 1 loại vé active mà (capacity - reserved - sold) > 0.
    // IFNULL bọc ngoài vì event chưa có ticket_types active nào thì LEFT JOIN ra NULL,
    // MAX(...) trên toàn NULL cũng ra NULL chứ không phải 0.
    const sql = `
        SELECT ${EVENT_SELECT},
            MIN(tt.price) AS min_price,
            IFNULL(MAX(CASE
                WHEN (tt.capacity - tt.reserved_quantity - tt.sold_quantity) > 0 THEN 1
                ELSE 0
            END), 0) AS has_available,
            CASE
              WHEN MAX(CASE WHEN tt.id IS NOT NULL
                AND (tt.capacity - tt.reserved_quantity - tt.sold_quantity) > 0
                AND NOW(3) >= COALESCE(tt.sales_start_at,e.sales_start_at)
                AND NOW(3) <= COALESCE(tt.sales_end_at,e.sales_end_at)
                THEN 1 ELSE 0 END)=1 THEN 'on-sale'
              WHEN MAX(CASE WHEN tt.id IS NOT NULL
                AND (tt.capacity - tt.reserved_quantity - tt.sold_quantity) > 0
                AND NOW(3) < COALESCE(tt.sales_start_at,e.sales_start_at)
                THEN 1 ELSE 0 END)=1 THEN 'coming-soon'
              WHEN COUNT(tt.id)>0 AND MAX(CASE WHEN
                (tt.capacity - tt.reserved_quantity - tt.sold_quantity)>0
                THEN 1 ELSE 0 END)=0 THEN 'sold-out'
              ELSE 'closed'
            END AS sale_status
        FROM events e
        LEFT JOIN ticket_types tt ON tt.event_id = e.id AND tt.is_active = TRUE
        ${whereClause}
        GROUP BY e.id
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
    `;

    const countSql = `
        SELECT COUNT(*) AS total
        FROM events e
        ${whereClause}
    `;

    const [rows] = await pool.query<EventRow[]>(sql, [...params, limit, offset]);
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, params);

    return {
        rows,
        total: countRows[0]?.total ?? 0,
    };
}

export async function findEventById(id: number) {
    const [rows] = await pool.query<EventRow[]>(
        `SELECT ${EVENT_SELECT}
         FROM events e
         WHERE e.id = ? AND e.status IN ('published','ongoing') AND e.visibility = 'visible'
         LIMIT 1`,
        [id]
    );
    return rows[0] ?? null;
}

export async function findTicketTypesByEventId(eventId: number) {
    const [rows] = await pool.query<TicketTypeRow[]>(
        `SELECT
            id, event_id, name, description, price,
            capacity, reserved_quantity, sold_quantity, max_per_order,
            sales_start_at, sales_end_at, is_active
         FROM ticket_types
         WHERE event_id = ? AND is_active = TRUE
         ORDER BY price ASC`,
        [eventId]
    );
    return rows;
}
