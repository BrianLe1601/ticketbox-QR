import { beforeEach, expect, it, vi } from "vitest";

const repoMock = vi.hoisted(() => ({
  findDueScheduledEvents: vi.fn(),
  findAdminEvent: vi.fn(),
  setEventPublished: vi.fn(),
  setPublishAttemptFailure: vi.fn(),
}));

vi.mock("../src/modules/events/admin-events.repository.js", () => repoMock);

import { processDueScheduledEvents } from "../src/modules/events/admin-events.service.js";
import { startScheduledPublishJob } from "../src/jobs/scheduled-publish.job.js";

beforeEach(() => {
  vi.resetAllMocks();
  repoMock.findDueScheduledEvents.mockResolvedValue([]);
});

it("publishes due scheduled draft events that satisfy readiness requirements", async () => {
  repoMock.findDueScheduledEvents.mockResolvedValue([101]);
  repoMock.findAdminEvent.mockResolvedValue({
    id: 101,
    name: "Tech Summit 2026",
    slug: "tech-summit-2026",
    description: "Annual summit",
    category_id: 1,
    category: "technology",
    venue: "Main Hall",
    address: "123 Tech St",
    city: "Da Nang",
    venue_capacity: 500,
    cover_image_url: "https://example.com/cover.jpg",
    cover_image_public_id: null,
    cover_image_alt: null,
    start_time: new Date(Date.now() + 86400000),
    end_time: new Date(Date.now() + 172800000),
    sales_start_at: new Date(Date.now() - 3600000),
    sales_end_at: new Date(Date.now() + 86400000),
    checkin_start_at: new Date(Date.now() + 86400000 - 3600000),
    checkin_end_at: new Date(Date.now() + 172800000),
    status: "draft",
    visibility: "visible",
    hidden_at: null,
    hidden_reason: null,
    hidden_by: null,
    scheduled_publish_at: new Date(Date.now() - 60000),
    published_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    completed_at: null,
    publish_failure_reason: null,
    ticket_type_count: 1,
    valid_ticket_type_count: 1,
    allocated_capacity: 200,
    sold_quantity: 0,
    pending_order_count: 0,
    confirmed_order_count: 0,
    active_staff_count: 0,
  });

  const result = await processDueScheduledEvents();

  expect(result).toEqual({ processed: 1, published: 1, failed: 0 });
  expect(repoMock.setEventPublished).toHaveBeenCalledWith(101);
  expect(repoMock.setPublishAttemptFailure).not.toHaveBeenCalled();
});

it("records failure when a scheduled draft event is missing publish requirements", async () => {
  repoMock.findDueScheduledEvents.mockResolvedValue([102]);
  repoMock.findAdminEvent.mockResolvedValue({
    id: 102,
    name: "Incomplete Event",
    slug: "incomplete-event",
    description: null,
    category_id: 1,
    category: "conference",
    venue: "Room B",
    address: "456 Main St",
    city: "Hanoi",
    venue_capacity: 100,
    cover_image_url: null, // missing cover image
    cover_image_public_id: null,
    cover_image_alt: null,
    start_time: new Date(Date.now() + 86400000),
    end_time: new Date(Date.now() + 172800000),
    sales_start_at: new Date(Date.now() - 3600000),
    sales_end_at: new Date(Date.now() + 86400000),
    checkin_start_at: new Date(Date.now() + 86400000 - 3600000),
    checkin_end_at: new Date(Date.now() + 172800000),
    status: "draft",
    visibility: "visible",
    hidden_at: null,
    hidden_reason: null,
    hidden_by: null,
    scheduled_publish_at: new Date(Date.now() - 60000),
    published_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    completed_at: null,
    publish_failure_reason: null,
    ticket_type_count: 0,
    valid_ticket_type_count: 0, // missing valid ticket
    allocated_capacity: 0,
    sold_quantity: 0,
    pending_order_count: 0,
    confirmed_order_count: 0,
    active_staff_count: 0,
  });

  const result = await processDueScheduledEvents();

  expect(result).toEqual({ processed: 1, published: 0, failed: 1 });
  expect(repoMock.setEventPublished).not.toHaveBeenCalled();
  expect(repoMock.setPublishAttemptFailure).toHaveBeenCalledWith(
    102,
    expect.stringContaining("Missing publish requirements"),
  );
});

it("starts and stops the scheduled publish job cleanly", () => {
  const job = startScheduledPublishJob();
  expect(typeof job.stop).toBe("function");
  job.stop();
});
