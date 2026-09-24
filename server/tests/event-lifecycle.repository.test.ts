import { beforeEach, expect, it, vi } from "vitest";

const database = vi.hoisted(() => {
  const connection = {
    beginTransaction: vi.fn(),
    execute: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
  };
  return {
    connection,
    pool: { getConnection: vi.fn(async () => connection) },
  };
});

vi.mock("../src/database/pool.js", () => ({ pool: database.pool }));

import { advanceEventLifecycle } from "../src/modules/events/event-lifecycle.repository.js";

beforeEach(() => {
  vi.resetAllMocks();
  database.pool.getConnection.mockResolvedValue(database.connection);
});

it("persists published -> ongoing -> completed in one ordered transaction", async () => {
  database.connection.execute
    .mockResolvedValueOnce([[{ id: 11 }, { id: 12 }]])
    .mockResolvedValueOnce([{ affectedRows: 2 }])
    .mockResolvedValueOnce([[{ id: 12 }]])
    .mockResolvedValueOnce([{ affectedRows: 1 }]);

  await expect(advanceEventLifecycle()).resolves.toEqual({
    started: 2,
    completed: 1,
    changes: [
      { eventId: 11, status: "ongoing" },
      { eventId: 12, status: "completed" },
    ],
  });

  expect(database.connection.beginTransaction).toHaveBeenCalledOnce();
  expect(database.connection.execute.mock.calls[0]?.[0]).toContain("FOR UPDATE");
  expect(database.connection.execute.mock.calls[1]?.[0]).toContain("status = 'ongoing'");
  expect(database.connection.execute.mock.calls[2]?.[0]).toContain("FOR UPDATE");
  expect(database.connection.execute.mock.calls[3]?.[0]).toContain("status = 'completed'");
  expect(database.connection.commit).toHaveBeenCalledOnce();
  expect(database.connection.rollback).not.toHaveBeenCalled();
  expect(database.connection.release).toHaveBeenCalledOnce();
});

it("is an idempotent no-op when no Event crosses a boundary", async () => {
  database.connection.execute
    .mockResolvedValueOnce([[]])
    .mockResolvedValueOnce([{ affectedRows: 0 }])
    .mockResolvedValueOnce([[]])
    .mockResolvedValueOnce([{ affectedRows: 0 }]);
  await expect(advanceEventLifecycle()).resolves.toEqual({
    started: 0,
    completed: 0,
    changes: [],
  });
  expect(database.connection.commit).toHaveBeenCalledOnce();
});

it("rolls back both transitions when completion update fails", async () => {
  database.connection.execute
    .mockResolvedValueOnce([[{ id: 11 }]])
    .mockResolvedValueOnce([{ affectedRows: 1 }])
    .mockRejectedValueOnce(new Error("database unavailable"));

  await expect(advanceEventLifecycle()).rejects.toThrow("database unavailable");
  expect(database.connection.commit).not.toHaveBeenCalled();
  expect(database.connection.rollback).toHaveBeenCalledOnce();
  expect(database.connection.release).toHaveBeenCalledOnce();
});
