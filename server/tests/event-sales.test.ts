import { describe, expect, it } from 'vitest';
import { deriveTicketSaleStatus, effectiveTicketSalesWindow, isEventAvailableForTicketDelivery } from '../src/modules/events/event-sales.js';

const date = (hour: number) => new Date(`2026-09-27T${String(hour).padStart(2, '0')}:00:00.000Z`);

describe('canonical Event and Ticket Type sales window', () => {
    it('uses the later opening and earlier closing boundary', () => {
        expect(effectiveTicketSalesWindow(date(8), date(20), date(10), date(18))).toEqual({ startAt: date(10), endAt: date(18) });
        expect(effectiveTicketSalesWindow(date(10), date(18), date(8), date(20))).toEqual({ startAt: date(10), endAt: date(18) });
    });

    it('does not advertise a tier outside the Event window as on sale', () => {
        const base = {
            eventStatus: 'published' as const,
            eventEndAt: date(23),
            eventSalesStartAt: date(10),
            eventSalesEndAt: date(18),
            available: 10,
        };
        expect(deriveTicketSaleStatus({ ...base, ticketSalesStartAt: date(8), ticketSalesEndAt: date(20), now: date(9) })).toBe('coming-soon');
        expect(deriveTicketSaleStatus({ ...base, ticketSalesStartAt: date(8), ticketSalesEndAt: date(20), now: date(19) })).toBe('closed');
        expect(deriveTicketSaleStatus({ ...base, ticketSalesStartAt: date(19), ticketSalesEndAt: date(20), now: date(12) })).toBe('closed');
        expect(deriveTicketSaleStatus({ ...base, ticketSalesStartAt: null, ticketSalesEndAt: null, now: date(12) })).toBe('on-sale');
    });
});

describe('ticket email Event eligibility', () => {
    it('accepts only a published/ongoing Event whose end time is still in the future', () => {
        const now = date(12);
        expect(isEventAvailableForTicketDelivery('published', date(13), now)).toBe(true);
        expect(isEventAvailableForTicketDelivery('ongoing', date(13), now)).toBe(true);
        expect(isEventAvailableForTicketDelivery('completed', date(13), now)).toBe(false);
        expect(isEventAvailableForTicketDelivery('published', date(12), now)).toBe(false);
    });
});
