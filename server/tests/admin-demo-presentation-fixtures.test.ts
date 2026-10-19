import { describe, expect, it } from "vitest";

import { alignDemoCheckinDay, createPresentationFixtures } from "../src/database/admin-demo-presentation-fixtures.js";
import { deriveTicketSaleStatus } from "../src/modules/events/event-sales.js";

describe("Admin demo concert fixtures", () => {
  it("keeps relative future/history fixtures valid at every Vietnam clock hour", () => {
    for (let hour = 0; hour < 24; hour++) {
      const start = new Date(`2026-10-07T${String(hour).padStart(2, "0")}:10:00+07:00`);
      const end = new Date(start.getTime() + 3 * 3_600_000);
      const aligned = alignDemoCheckinDay(start, new Date(start.getTime() - 2 * 3_600_000));
      const localDate = (date: Date) => new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
      expect(localDate(aligned.start)).toBe(localDate(aligned.checkinStart));
      expect(aligned.start.getTime() - aligned.checkinStart.getTime()).toBe(2 * 3_600_000);
      expect(aligned.start.getTime()).toBeLessThan(end.getTime());
    }
  });

  it("keeps the legacy ongoing Event in the past when seeding after midnight", () => {
    const now = new Date("2026-10-06T01:10:00+07:00");
    const start = new Date(now.getTime() - 3_600_000);
    const aligned = alignDemoCheckinDay(start, new Date(start.getTime() - 2 * 3_600_000), true);
    expect(aligned.start.toISOString()).toBe("2026-10-05T16:00:00.000Z");
    expect(aligned.start.getTime()).toBeLessThan(now.getTime());
    expect(aligned.start.getTime() - aligned.checkinStart.getTime()).toBe(2 * 3_600_000);
  });

  // Fixed reference: Saturday 17 October 2026, 10:00 Vietnam time.
  const reference = new Date("2026-10-17T10:00:00+07:00");
  const vietnamDate = (date: Date) => new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

  it("provides ten isolated Events, distinct active local Staff and twenty tiers", () => {
    const fixtures = createPresentationFixtures(reference);
    expect(fixtures).toHaveLength(10);
    expect(new Set(fixtures.map(({ event }) => event.slug)).size).toBe(10);
    expect(new Set(fixtures.map(({ staff }) => staff.email)).size).toBe(10);
    expect(fixtures.flatMap(({ ticketTypes }) => ticketTypes)).toHaveLength(20);
    for (const { event, staff, ticketTypes } of fixtures) {
      expect(event.slug).toMatch(/^demo-admin-presentation-\d{2}$/);
      expect(event.name).toMatch(/Concert|concert|nhạc|Acoustic|Pop|Rock|EDM/);
      expect(event.name).not.toMatch(/Workshop|Hội nghị|Triển lãm|khởi nghiệp/);
      const genreKeys = { Pop: "music", Rock: "technology", EDM: "community", Acoustic: "acoustic" };
      const genre = Object.keys(genreKeys).find((value) => event.name.includes(value)) as keyof typeof genreKeys;
      expect(genre).toBeDefined();
      expect(event.categoryKey).toBe(genreKeys[genre]);
      expect(staff.email).toMatch(/^demo\.staff\.presentation\.\d{2}@ticketbox\.local$/);
      expect(staff.googleSub).toBeNull();
      expect(staff.approvalStatus).toBe("approved");
      expect(staff.finalActive).toBe(true);
      expect(ticketTypes.every((tier) => tier.eventKey === event.key)).toBe(true);
      expect(ticketTypes.reduce((sum, tier) => sum + tier.capacity, 0)).toBe(event.capacity);
      expect(ticketTypes.some((tier) => tier.price === 0)).toBe(true);
      expect(ticketTypes.some((tier) => tier.price > 0)).toBe(true);
    }
  });

  it("gives every concert its own Vietnam day with a same-day two-hour check-in lead", () => {
    const fixtures = createPresentationFixtures(reference);
    const days = fixtures.map(({ event }) => vietnamDate(event.start));
    expect(days[0]).toBe("2026-10-18");
    expect(new Set(days).size).toBe(10);
    for (const { event } of fixtures) {
      expect(event.start.getTime() - event.checkinStart.getTime()).toBe(2 * 3_600_000);
      expect(event.checkinEnd.getTime()).toBeLessThanOrEqual(event.end.getTime());
      expect(vietnamDate(event.checkinStart)).toBe(vietnamDate(event.start));
    }
  });

  it("never overlaps in the single venue, including touching boundaries", () => {
    // The venue is occupied over [checkinStart, end]; closed intervals mean even a touch conflicts.
    const slots = createPresentationFixtures(reference)
      .map(({ event }) => [event.checkinStart.getTime(), event.end.getTime()] as const)
      .sort((a, b) => a[0] - b[0]);
    for (let index = 1; index < slots.length; index++) {
      expect(slots[index]![0]).toBeGreaterThan(slots[index - 1]![1]);
    }
  });

  it("opens sales before the seed runs for every concert", () => {
    for (const { event } of createPresentationFixtures(reference)) {
      expect(event.salesStart.getTime()).toBeLessThanOrEqual(reference.getTime());
      expect(event.salesStart.getTime()).toBeLessThan(event.start.getTime());
      expect(event.salesEnd.getTime()).toBeLessThanOrEqual(event.end.getTime());
    }
  });

  it.each(["13:00:00", "14:00:00", "15:00:00", "16:00:00"])(
    "allows buying and check-in at %s Vietnam time on each concert day without bypassing lifecycle rules", (time) => {
      for (const { event, ticketTypes } of createPresentationFixtures(reference)) {
        const now = new Date(`${vietnamDate(event.start)}T${time}+07:00`);
        expect(now.getTime()).toBeGreaterThanOrEqual(event.checkinStart.getTime());
        expect(now.getTime()).toBeLessThan(event.checkinEnd.getTime());
        for (const tier of ticketTypes) {
          expect(deriveTicketSaleStatus({
            eventStatus: now < event.start ? "published" : "ongoing",
            eventEndAt: event.end,
            eventSalesStartAt: event.salesStart,
            eventSalesEndAt: event.salesEnd,
            ticketSalesStartAt: null, ticketSalesEndAt: null,
            available: tier.capacity, now,
          })).toBe("on-sale");
        }
      }
    },
  );

  it("does not extend buying or check-in beyond the configured window", () => {
    for (const { event } of createPresentationFixtures(reference)) {
      const now = new Date(`${vietnamDate(event.start)}T16:31:00+07:00`);
      expect(now.getTime()).toBeGreaterThan(event.checkinEnd.getTime());
      expect(deriveTicketSaleStatus({
        eventStatus: "ongoing", eventEndAt: event.end,
        eventSalesStartAt: event.salesStart, eventSalesEndAt: event.salesEnd,
        ticketSalesStartAt: null, ticketSalesEndAt: null, available: 100, now,
      })).toBe("closed");
    }
  });
});
