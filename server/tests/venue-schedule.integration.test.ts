import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pool } from '../src/database/pool.js';
import { createAdminEvent, getAdminEventById, updateAdminEvent } from '../src/modules/events/admin-events.service.js';
import { setEventCancelled } from '../src/modules/events/admin-events.repository.js';
import type { CreateAdminEventInput } from '../src/modules/events/admin-events.schema.js';
import { getPlatformSettings, saveVenue } from '../src/modules/platform-settings/platform-settings.service.js';

// Real-MySQL suite: refuses any database that is not a disposable ticketboxqr_test_* copy.
// It runs next to other integration suites in the same database, so every Event here sits
// in a far-future slot (+150 days and later) that those suites never use.
const runId = `venue-${Date.now()}`;
const eventIds: number[] = [];
let adminId = 0;
let musicSlug = '';
let otherSlug = '';
const categoryIds: number[] = [];
let originalSettings: RowDataPacket | undefined;

const venueA = { name: 'Venue Test Hall', address: '1 Test Street', city: 'Test City', capacity: 500 };

/** YYYY-MM-DD for today + 150 + offset days (distinct far-future Vietnam dates). */
function day(offset: number) {
    const date = new Date(Date.now() + (150 + offset) * 86_400_000);
    return date.toISOString().slice(0, 10);
}

/** One concert: check-in 06:00, start 08:30, end 10:00 (+07:00) unless overridden. */
function concert(label: string, date: string, overrides: Partial<CreateAdminEventInput> = {}): CreateAdminEventInput {
    const at = (time: string) => `${date}T${time}+07:00`;
    const previous = new Date(new Date(`${date}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
    return {
        name: `${runId} ${label}`,
        category: musicSlug,
        startTime: at('08:30:00'),
        endTime: at('10:00:00'),
        salesStartAt: `${previous}T00:00:00+07:00`,
        salesEndAt: at('09:30:00'),
        checkinStartAt: at('06:00:00'),
        checkinEndAt: at('09:30:00'),
        ...overrides,
    };
}

async function create(label: string, date: string, overrides: Partial<CreateAdminEventInput> = {}) {
    const event = await createAdminEvent(concert(label, date, overrides), adminId);
    eventIds.push(event.id);
    return event;
}

async function publish(eventId: number) {
    await pool.query(
        `INSERT INTO ticket_types (event_id, name, price, capacity, max_per_order, is_active)
         VALUES (?, 'General', 100000, 10, 4, TRUE)`,
        [eventId],
    );
    await pool.query(`UPDATE events SET status = 'published', published_at = NOW(3) WHERE id = ?`, [eventId]);
}

async function restoreSettings() {
    if (!originalSettings) return;
    await pool.query(
        `UPDATE platform_settings SET venue_name = ?, venue_address = ?, venue_city = ?, venue_capacity = ?,
           updated_by = ? WHERE id = 1`,
        [originalSettings.venue_name, originalSettings.venue_address, originalSettings.venue_city,
            originalSettings.venue_capacity, originalSettings.updated_by],
    );
}

describe.sequential('single-venue scheduling and platform settings (disposable MySQL)', () => {
    beforeAll(async () => {
        if (!process.env.DB_NAME?.startsWith('ticketboxqr_test_')) {
            throw new Error('Venue integration requires a disposable ticketboxqr_test_* database');
        }
        const [settings] = await pool.query<RowDataPacket[]>('SELECT * FROM platform_settings WHERE id = 1');
        originalSettings = settings[0];
        const [admin] = await pool.query<ResultSetHeader>(
            `INSERT INTO users (full_name, email, password_hash, role, is_active)
             VALUES ('Venue Test Admin', ?, 'not-used-by-integration-test', 'admin', TRUE)`,
            [`${runId}@ticketbox.local`],
        );
        adminId = admin.insertId;
        // Inserted directly (the API cannot create Categories): one stand-in catalogue genre and one legacy row.
        for (const [kind, suffix] of [['music', 'music'], ['other', 'other']] as const) {
            const slug = `${runId}-${suffix}`;
            const [category] = await pool.query<ResultSetHeader>(
                `INSERT INTO categories (name, slug, kind, sort_order) VALUES (?, ?, ?, 9999)`,
                [`Venue ${runId} ${suffix}`, slug, kind],
            );
            categoryIds.push(category.insertId);
            if (kind === 'music') musicSlug = slug; else otherSlug = slug;
        }
        await saveVenue(adminId, venueA);
    });

    afterAll(async () => {
        await restoreSettings();
        if (eventIds.length > 0) {
            const placeholders = eventIds.map(() => '?').join(', ');
            await pool.query(`DELETE oi FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.event_id IN (${placeholders})`, eventIds);
            await pool.query(`DELETE FROM orders WHERE event_id IN (${placeholders})`, eventIds);
            await pool.query(`DELETE FROM event_staff WHERE event_id IN (${placeholders})`, eventIds);
            await pool.query(
                `UPDATE events SET visibility = 'hidden', hidden_at = NOW(3), hidden_reason = 'venue test cleanup', hidden_by = ?
                 WHERE id IN (${placeholders}) AND visibility = 'visible' AND status IN ('published', 'ongoing', 'cancelled')`,
                [adminId, ...eventIds],
            );
            await pool.query(`DELETE FROM ticket_types WHERE event_id IN (${placeholders})`, eventIds);
            await pool.query(`DELETE FROM events WHERE id IN (${placeholders})`, eventIds);
        }
        if (categoryIds.length > 0) await pool.query(`DELETE FROM categories WHERE id IN (${categoryIds.map(() => '?').join(', ')})`, categoryIds);
        if (adminId) {
            await pool.query('UPDATE platform_settings SET updated_by = NULL WHERE updated_by = ?', [adminId]);
            await pool.query('DELETE FROM users WHERE id = ?', [adminId]);
        }
        await pool.end();
    });

    it('copies the platform venue into a new Event instead of accepting typed venue fields', async () => {
        const event = await create('snapshot', day(0));
        expect(event).toMatchObject({
            venue: venueA.name, address: venueA.address, city: venueA.city, venueCapacity: venueA.capacity,
        });
    });

    it('requires a configured venue', async () => {
        await pool.query(
            `UPDATE platform_settings SET venue_name = NULL, venue_address = NULL, venue_city = NULL, venue_capacity = NULL WHERE id = 1`,
        );
        try {
            await expect(createAdminEvent(concert('no-venue', day(1)), adminId)).rejects.toMatchObject({ code: 'VENUE_NOT_CONFIGURED' });
        } finally {
            await saveVenue(adminId, venueA);
        }
    });

    it('rejects an Event whose occupied interval overlaps another, including a touching boundary', async () => {
        const date = day(2);
        await create('overlap-base', date); // occupies 06:00-10:00
        await expect(createAdminEvent(concert('overlap-same', date), adminId))
            .rejects.toMatchObject({ code: 'VENUE_SCHEDULE_CONFLICT', statusCode: 409 });
        // Check-in opens exactly when the first concert ends: closed intervals conflict.
        const touching = concert('overlap-touch', date, {
            checkinStartAt: `${date}T10:00:00+07:00`, startTime: `${date}T12:30:00+07:00`,
            endTime: `${date}T14:00:00+07:00`, checkinEndAt: `${date}T13:30:00+07:00`, salesEndAt: `${date}T13:30:00+07:00`,
        });
        await expect(createAdminEvent(touching, adminId)).rejects.toMatchObject({ code: 'VENUE_SCHEDULE_CONFLICT' });
        // One second later the venue is free.
        const later = await create('overlap-after', date, {
            checkinStartAt: `${date}T10:00:01+07:00`, startTime: `${date}T12:30:00+07:00`,
            endTime: `${date}T14:00:00+07:00`, checkinEndAt: `${date}T13:30:00+07:00`, salesEndAt: `${date}T13:30:00+07:00`,
        });
        expect(later.id).toBeGreaterThan(0);
    });

    it('lets exactly one of many concurrent Admins book the same slot', async () => {
        const date = day(3);
        const results = await Promise.allSettled(
            Array.from({ length: 8 }, (_, index) => createAdminEvent(concert(`race-${index}`, date), adminId)),
        );
        const winners = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof createAdminEvent>>> => result.status === 'fulfilled');
        for (const winner of winners) eventIds.push(winner.value.id);
        const losers = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
        expect(winners).toHaveLength(1);
        expect(losers).toHaveLength(7);
        for (const loser of losers) expect(loser.reason).toMatchObject({ code: 'VENUE_SCHEDULE_CONFLICT' });
        const [rows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM events WHERE name LIKE ?', [`${runId} race-%`]);
        expect(Number(rows[0]?.total)).toBe(1);
    });

    it('rejects moving an Event onto another Event slot and allows an unrelated edit', async () => {
        const first = await create('move-a', day(4));
        const second = await create('move-b', day(5));
        const target = day(4);
        await expect(updateAdminEvent(second.id, {
            startTime: `${target}T08:30:00+07:00`, endTime: `${target}T10:00:00+07:00`,
            salesStartAt: `${day(3)}T00:00:00+07:00`, salesEndAt: `${target}T09:30:00+07:00`,
            checkinStartAt: `${target}T06:00:00+07:00`, checkinEndAt: `${target}T09:30:00+07:00`,
        })).rejects.toMatchObject({ code: 'VENUE_SCHEDULE_CONFLICT' });
        const renamed = await updateAdminEvent(first.id, { name: `${runId} move-a renamed` });
        expect(renamed.name).toContain('renamed');
    });

    it('releases the venue when an Event is cancelled', async () => {
        const date = day(6);
        const event = await create('cancel-frees', date);
        await publish(event.id);
        await expect(createAdminEvent(concert('cancel-blocked', date), adminId)).rejects.toMatchObject({ code: 'VENUE_SCHEDULE_CONFLICT' });
        await setEventCancelled(event.id, 'Venue integration cancellation', adminId);
        const replacement = await create('cancel-replacement', date);
        expect(replacement.id).not.toBe(event.id);
    });

    it('accepts only catalogue genres for a new Event, never a legacy Category', async () => {
        await expect(createAdminEvent(concert('other-blocked', day(7), { category: otherSlug }), adminId))
            .rejects.toMatchObject({ code: 'CATEGORY_NOT_MUSIC', statusCode: 409 });
        const event = await create('genre-allowed', day(7));
        expect(event.category).toBe(musicSlug);
    });

    it('ships the 19-genre catalogue with the catch-all genre', async () => {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT slug FROM categories WHERE kind = 'music' AND slug NOT LIKE 'venue-%' ORDER BY sort_order",
        );
        expect(rows).toHaveLength(19);
        expect(rows.map((row) => row.slug)).toEqual(expect.arrayContaining(['pop', 'rock', 'edm', 'acoustic', 'the-loai-khac']));
    });

    it('does not block editing an Event that keeps a legacy non-music Category', async () => {
        const legacy = await create('legacy-category', day(8), { category: musicSlug });
        await pool.query('UPDATE events SET category_id = ? WHERE id = ?', [categoryIds[1], legacy.id]);
        const renamed = await updateAdminEvent(legacy.id, { name: `${runId} legacy-category renamed`, category: otherSlug });
        expect(renamed.category).toBe(otherSlug);
    });

    it('syncs the current venue into a Draft, confirms for published, and locks once sold', async () => {
        const draft = await create('sync-draft', day(9));
        const published = await create('sync-published', day(10));
        await publish(published.id);
        const sold = await create('sync-sold', day(11));
        await publish(sold.id);
        await pool.query(
            `INSERT INTO orders (order_code, event_id, buyer_name, buyer_email, total_quantity, subtotal_amount,
               total_amount, status, lookup_token_hash, expires_at)
             VALUES (?, ?, 'Buyer', 'buyer@example.com', 1, 0, 0, 'pending_payment', REPEAT('a', 64),
               DATE_ADD(NOW(3), INTERVAL 10 MINUTE))`,
            [`V${Date.now() % 1e9}`, sold.id],
        );

        const venueB = { name: 'Venue Test Arena', address: '2 Test Avenue', city: 'Test City', capacity: 800 };
        await saveVenue(adminId, venueB);
        try {
            expect((await getPlatformSettings()).outOfSyncEventCount).toBeGreaterThanOrEqual(3);
            // Existing Events keep their snapshot until synced.
            expect((await getAdminEventById(draft.id)).venue).toBe(venueA.name);

            const synced = await updateAdminEvent(draft.id, { syncVenue: true });
            expect(synced).toMatchObject({ venue: venueB.name, address: venueB.address, venueCapacity: venueB.capacity });

            await expect(updateAdminEvent(published.id, { syncVenue: true }))
                .rejects.toMatchObject({ code: 'VENUE_CHANGE_CONFIRMATION_REQUIRED' });
            const confirmed = await updateAdminEvent(published.id, { syncVenue: true, confirmPublicVenueChange: true });
            expect(confirmed.venue).toBe(venueB.name);

            await expect(updateAdminEvent(sold.id, { syncVenue: true, confirmPublicVenueChange: true }))
                .rejects.toMatchObject({ code: 'VENUE_LOCKED_BY_SALES' });
            expect((await getAdminEventById(sold.id)).venue).toBe(venueA.name);
        } finally {
            await saveVenue(adminId, venueA);
        }
    });

    it('rejects syncing a venue smaller than the tickets already allocated', async () => {
        const event = await create('sync-capacity', day(12));
        await publish(event.id); // allocates 10 seats
        await saveVenue(adminId, { ...venueA, capacity: 5 });
        try {
            await expect(updateAdminEvent(event.id, { syncVenue: true, confirmPublicVenueChange: true }))
                .rejects.toMatchObject({ code: 'VENUE_CAPACITY_BELOW_ALLOCATION' });
        } finally {
            await saveVenue(adminId, venueA);
        }
    });
});
