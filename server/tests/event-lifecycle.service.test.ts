import { beforeEach, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  advanceEventLifecycle: vi.fn(),
}));

vi.mock("../src/modules/events/event-lifecycle.repository.js", () => repository);

import {
  deriveEventLifecycleStatus,
  syncEventLifecycleStatuses,
} from "../src/modules/events/event-lifecycle.service.js";

const now = new Date("2026-09-24T12:00:00.000Z");

beforeEach(() => {
  vi.resetAllMocks();
  repository.advanceEventLifecycle.mockResolvedValue({ started: 0, completed: 0, changes: [] });
});

it("keeps a future published Event published", () => {
  expect(deriveEventLifecycleStatus({
    status: "published",
    startTime: "2026-09-24T13:00:00.000Z",
    endTime: "2026-09-24T15:00:00.000Z",
  }, now)).toBe("published");
});

it("derives ongoing when a published Event reaches its start time", () => {
  expect(deriveEventLifecycleStatus({
    status: "published",
    startTime: "2026-09-24T11:00:00.000Z",
    endTime: "2026-09-24T15:00:00.000Z",
  }, now)).toBe("ongoing");
});

it.each(["published", "ongoing"] as const)(
  "derives completed when a %s Event has passed its end time",
  (status) => {
    expect(deriveEventLifecycleStatus({
      status,
      startTime: "2026-09-24T09:00:00.000Z",
      endTime: "2026-09-24T11:59:59.000Z",
    }, now)).toBe("completed");
  },
);

it("never overwrites a cancelled terminal state", () => {
  expect(deriveEventLifecycleStatus({
    status: "cancelled",
    startTime: "2026-09-24T09:00:00.000Z",
    endTime: "2026-09-24T11:00:00.000Z",
  }, now)).toBe("cancelled");
});

it("delegates persisted synchronization and returns its counts", async () => {
  repository.advanceEventLifecycle.mockResolvedValue({
    started: 2,
    completed: 3,
    changes: [{ eventId: 5, status: "completed" }],
  });
  await expect(syncEventLifecycleStatuses()).resolves.toEqual({
    started: 2,
    completed: 3,
    changes: [{ eventId: 5, status: "completed" }],
  });
  expect(repository.advanceEventLifecycle).toHaveBeenCalledOnce();
});
