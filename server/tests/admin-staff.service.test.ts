import { beforeEach, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  listAssignmentRows: vi.fn(), listStaffRows: vi.fn(), lockEvent: vi.fn(),
  lockStaff: vi.fn(), revokeAllAssignments: vi.fn(), revokeAllSessions: vi.fn(),
  withStaffTransaction: vi.fn(),
}));
vi.mock("../src/modules/admin-staff/admin-staff.repository.js", () => repo);

import { assignStaff, changeStaffStatus } from "../src/modules/admin-staff/admin-staff.service.js";

const events: string[] = [];
const conn = {
  execute: vi.fn(async (sql: string) => {
    events.push(sql.trim().split(" ")[0] ?? "SQL");
    if (sql.includes("INSERT INTO event_staff")) return [{ insertId: 42 }];
    return [[]];
  }),
};

beforeEach(() => {
  vi.resetAllMocks();
  events.length = 0;
  repo.withStaffTransaction.mockImplementation(async (work: (connection: typeof conn) => Promise<unknown>) => work(conn));
  repo.lockStaff.mockResolvedValue({ id: 3, isActive: 1, approvalStatus: "approved" });
  repo.lockEvent.mockResolvedValue({ id: 8, status: "published", endTime: new Date("2099-01-01T00:00:00.000Z") });
  repo.revokeAllAssignments.mockImplementation(async () => { events.push("revokeAssignments"); });
  repo.revokeAllSessions.mockImplementation(async () => { events.push("revokeSessions"); });
});

it("revokes assignments before deactivating a Staff account and its sessions", async () => {
  await changeStaffStatus(3, 7, "deactivate");
  expect(events).toEqual(["revokeAssignments", "UPDATE", "revokeSessions"]);
  expect(conn.execute).toHaveBeenCalledWith(
    expect.stringContaining("UPDATE users SET is_active = FALSE"), [3],
  );
});

it("does not allow a pending account to be reactivated without approval", async () => {
  repo.lockStaff.mockResolvedValue({ id: 3, isActive: 0, approvalStatus: "pending" });
  await expect(changeStaffStatus(3, 7, "reactivate")).rejects.toMatchObject({
    code: "STAFF_NOT_APPROVED",
  });
  expect(conn.execute).not.toHaveBeenCalled();
});

it("does not assign pending or disabled Staff", async () => {
  repo.lockStaff.mockResolvedValue({ id: 3, isActive: 0, approvalStatus: "pending" });
  await expect(assignStaff(3, 8, 7)).rejects.toMatchObject({ code: "STAFF_INACTIVE" });
  expect(conn.execute).not.toHaveBeenCalled();
});

it("does not assign a terminal Event", async () => {
  repo.lockEvent.mockResolvedValue({ id: 8, status: "cancelled", endTime: new Date("2099-01-01T00:00:00.000Z") });
  await expect(assignStaff(3, 8, 7)).rejects.toMatchObject({ code: "EVENT_CLOSED" });
  expect(repo.lockStaff).not.toHaveBeenCalled();
});

it("does not assign an Event whose end time has passed", async () => {
  repo.lockEvent.mockResolvedValue({ id: 8, status: "ongoing", endTime: new Date("2020-01-01T00:00:00.000Z") });
  await expect(assignStaff(3, 8, 7)).rejects.toMatchObject({ code: "EVENT_ENDED" });
  expect(repo.lockStaff).not.toHaveBeenCalled();
});

it("creates an assignment only for approved Staff and an open Event", async () => {
  const result = await assignStaff(3, 8, 7);
  expect(result).toEqual({ assignmentId: 42, staffId: 3, eventId: 8 });
  expect(repo.lockEvent).toHaveBeenCalledWith(conn, 8);
  expect(repo.lockStaff).toHaveBeenCalledWith(conn, 3);
});
