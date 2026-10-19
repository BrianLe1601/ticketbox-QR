import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/modules/ticket-types/admin-ticket-types.repository.js", () => ({
  allocatedCapacity: vi.fn(async () => 0),
  countActiveValidTicketTypes: vi.fn(async () => 1),
  deleteTicketType: vi.fn(),
  findInventoryEvent: vi.fn(),
  findTicketType: vi.fn(),
  insertTicketType: vi.fn(async () => 1),
  listTicketTypes: vi.fn(async () => []),
  setTicketSalesStatus: vi.fn(),
  updateDraftTicketType: vi.fn(),
}));

const repo = await import("../src/modules/ticket-types/admin-ticket-types.repository.js");
const { createTicketType } = await import("../src/modules/ticket-types/admin-ticket-types.service.js");

// Gates close 21:30, the show ends 22:00 (Vietnam time).
const event = {
  id: 9, name: "Đêm nhạc", status: "draft", visibility: "visible", venue_capacity: 500,
  start_time: new Date("2026-11-20T12:00:00.000Z"), end_time: new Date("2026-11-20T15:00:00.000Z"),
  sales_start_at: new Date("2026-10-20T01:00:00.000Z"), sales_end_at: new Date("2026-11-20T12:00:00.000Z"),
  checkin_end_at: new Date("2026-11-20T14:30:00.000Z"),
};
const input = (salesEndAt?: string) => ({ eventId: 9, name: "VIP", price: 100_000, capacity: 10, maxPerOrder: 4, ...(salesEndAt ? { salesEndAt } : {}) });

describe("Ticket Type sales must close by check-in end", () => {
  beforeEach(() => {
    vi.mocked(repo.findInventoryEvent).mockResolvedValue(event as never);
    vi.mocked(repo.insertTicketType).mockClear();
  });

  it("rejects a tier selling after the gates close, even before the Event end", async () => {
    await expect(createTicketType(input("2026-11-20T14:45:00.000Z") as never))
      .rejects.toMatchObject({ code: "TICKET_SALES_AFTER_CHECKIN_END" });
    expect(repo.insertTicketType).not.toHaveBeenCalled();
  });

  it("keeps the Event-end error for a tier selling past the show", async () => {
    await expect(createTicketType(input("2026-11-20T15:30:00.000Z") as never))
      .rejects.toMatchObject({ code: "TICKET_SALES_AFTER_EVENT_END" });
  });

  it("accepts a tier closing exactly at check-in end, or inheriting the Event window", async () => {
    vi.mocked(repo.findTicketType).mockResolvedValue({ id: 1, event_id: 9 } as never);
    await expect(createTicketType(input("2026-11-20T14:30:00.000Z") as never)).resolves.toBeDefined();
    await expect(createTicketType(input() as never)).resolves.toBeDefined();
  });
});
