import { beforeEach, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  syncEventLifecycleStatuses: vi.fn(),
}));

vi.mock("../src/modules/events/event-lifecycle.service.js", () => service);

import { runEventLifecycleTick } from "../src/jobs/event-lifecycle.job.js";

beforeEach(() => {
  vi.resetAllMocks();
});

it("broadcasts only after the committed lifecycle sync reports changes", async () => {
  const result = {
    started: 1,
    completed: 0,
    changes: [{ eventId: 42, status: "ongoing" as const }],
  };
  service.syncEventLifecycleStatuses.mockResolvedValue(result);
  const onUpdate = vi.fn();

  await expect(runEventLifecycleTick(onUpdate)).resolves.toEqual(result);
  expect(onUpdate).toHaveBeenCalledOnce();
  expect(onUpdate).toHaveBeenCalledWith(result);
});

it("does not broadcast an idempotent lifecycle no-op", async () => {
  service.syncEventLifecycleStatuses.mockResolvedValue({
    started: 0,
    completed: 0,
    changes: [],
  });
  const onUpdate = vi.fn();

  await runEventLifecycleTick(onUpdate);
  expect(onUpdate).not.toHaveBeenCalled();
});
